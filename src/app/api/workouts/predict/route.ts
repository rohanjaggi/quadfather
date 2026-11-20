import { NextResponse } from 'next/server'
import { findUserAICredentials } from '@/lib/auth'
import type { AICredentials } from '@/lib/models'
import { generateSuggestion } from '@/lib/progress'
import {
  fetchExerciseHistory,
  buildPredictPrompt,
  parsePredictionResponse,
  suggestionToSets,
} from '@/lib/predict'
import { callModel, MAX_TOKENS_JSON } from '@/lib/ai'
import { prisma } from '@/lib/prisma'
import { withUser, requireString } from '@/lib/api-handler'
import { dayKey } from '@/lib/day'
import type { PredictionData } from '@/types/exercises'

/**
 * Prediction cache keyed on `ProgressSnapshot.updated_at`, so a hit skips the paid AI call.
 * Per-warm-instance in-memory Map: not shared across serverless instances, lost on cold
 * start; it only collapses the burst of identical requests one page open produces.
 */
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

/** `PredictionData` with `weight_kg` widened to `number | null` for bodyweight sets. */
type PredictionResponse = Omit<PredictionData, 'prediction'> & {
  prediction: {
    sets: { reps: number; weight_kg: number | null }[]
    reasoning: string
  } | null
}

const predictionCache = new Map<string, { expires: number; value: PredictionResponse }>()

function cacheGet(key: string): PredictionResponse | null {
  const hit = predictionCache.get(key)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    predictionCache.delete(key)
    return null
  }
  // Re-insert to move this key to the back, making eviction a plain LRU.
  predictionCache.delete(key)
  predictionCache.set(key, hit)
  return hit.value
}

function cacheSet(key: string, value: PredictionResponse): void {
  predictionCache.delete(key)
  predictionCache.set(key, { expires: Date.now() + CACHE_TTL_MS, value })
  while (predictionCache.size > CACHE_MAX_ENTRIES) {
    const oldest = predictionCache.keys().next()
    if (oldest.done) break
    predictionCache.delete(oldest.value)
  }
}

export const GET = withUser(async (request, user) => {
  const exerciseName = requireString(
    request.nextUrl.searchParams.get('exercise_name'),
    'exercise_name',
    { maxLength: 100 },
  )

  const snapshot = await prisma.progressSnapshot.findUnique({
    where: {
      user_id_exercise_name: {
        user_id: user.id,
        exercise_name: exerciseName,
      },
    },
  })

  // Resolved first because the prediction depends on provider and model; an undecryptable key counts as none.
  let credentials: AICredentials | null = null
  try {
    credentials = findUserAICredentials(user)
  } catch {
    credentials = null
  }

  // Everything the prompt and the fallback read goes in the key, so changing focus, goal,
  // body weight or provider doesn't serve a stale prediction.
  const cacheKey = [
    user.id,
    exerciseName,
    snapshot?.updated_at?.toISOString() ?? 'none',
    user.training_focus ?? '',
    user.fitness_goal ?? '',
    user.weight_kg ?? '',
    credentials?.provider ?? 'none',
    // null = the provider's default model.
    credentials?.model ?? '',
  ].join(':')
  const cached = cacheGet(cacheKey)
  if (cached) return NextResponse.json(cached)

  const history = await fetchExerciseHistory(user.id, exerciseName)

  if (!snapshot || history.length === 0) {
    // Not cached: no AI call to save, and the next logged set should change the answer.
    return NextResponse.json({
      prediction: null,
      confidence: 'low',
      fallback_used: true,
      last_session: null,
    } satisfies PredictionData)
  }

  const lastSession = history[0]
  const lastSessionData = {
    date: dayKey(lastSession.workout_date),
    sets: lastSession.sets,
  }

  // Anchor on the weight record the PR list shows; `best_set_weight` (best e1RM) can be lighter.
  // Pre-backfill rows carry 0, hence the fallback to best_set_*.
  const heaviest = {
    weight: snapshot.best_weight > 0 ? snapshot.best_weight : snapshot.best_set_weight,
    reps:
      snapshot.best_weight > 0 && snapshot.best_weight_reps > 0
        ? snapshot.best_weight_reps
        : snapshot.best_set_reps,
  }

  let prediction: PredictionResponse
  try {
    if (!credentials) throw new Error('no AI credentials')

    const prompt = buildPredictPrompt(exerciseName, user, snapshot, history, heaviest)
    const raw = await callModel(credentials, prompt, MAX_TOKENS_JSON)
    const result = parsePredictionResponse(raw)

    const confidence = history.length >= 5 ? 'high' : history.length >= 3 ? 'medium' : 'low'

    prediction = {
      prediction: result,
      confidence,
      fallback_used: false,
      last_session: lastSessionData,
    }
    cacheSet(cacheKey, prediction)
  } catch (e) {
    if (credentials) console.error('predict AI failed:', e)
    const fallbackSuggestion = generateSuggestion(
      user.training_focus ?? null,
      heaviest.weight,
      heaviest.reps,
      snapshot.sessions_since_improvement,
    )

    prediction = {
      prediction: {
        sets: suggestionToSets(
          fallbackSuggestion,
          heaviest.weight,
          heaviest.reps,
          lastSession.sets.filter(s => (s.weight_kg ?? 0) > 0).length,
          // Only the hypertrophy branch resets reps to 8 on a weight bump.
          user.training_focus ?? null,
        ),
        reasoning: fallbackSuggestion.reason,
      },
      confidence: 'low',
      fallback_used: true,
      last_session: lastSessionData,
    }
    // Not cached: the AI call failed, so the next request should retry.
  }

  return NextResponse.json(prediction)
})
