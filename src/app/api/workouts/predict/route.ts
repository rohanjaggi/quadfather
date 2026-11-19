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
 * Server-side prediction cache.
 *
 * `ExerciseSuggestion` fires one paid model call per exercise on every
 * template open and every typing pause, and the prediction only changes when
 * the exercise's `ProgressSnapshot` does — so key on `snapshot.updated_at` and
 * a hit skips the AI call entirely.
 *
 * This is a per-warm-instance, in-memory Map: it is NOT shared between
 * serverless instances and is lost on cold start. That's fine — it exists to
 * collapse the burst of identical requests one page open produces, not to be a
 * durable cache. (A shared cache would mean a `predictions` table or Redis.)
 */
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

/**
 * `PredictionData` with the prediction's `weight_kg` widened to `number | null`:
 * a bodyweight set has no load, and the parser now says so rather than throwing.
 * (`src/types/exercises.ts` still declares the narrow shape — see the note in
 * this change's report; the UI renders `{set.weight_kg}kg`, which needs a
 * "bodyweight" branch.)
 */
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
  // Refresh recency: Map preserves insertion order, so re-inserting moves this
  // key to the back and makes the eviction below a plain LRU.
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

  // Resolved before the key is built, because the prediction depends on the
  // provider and model too. A key that can't be decrypted counts as no key.
  let credentials: AICredentials | null = null
  try {
    credentials = findUserAICredentials(user)
  } catch {
    credentials = null
  }

  // Everything the prompt (and the deterministic fallback) reads goes in the
  // key. Keying on the snapshot alone meant changing your training focus, goal
  // or body weight — or switching provider/model — kept serving the prediction
  // computed from the old settings for up to an hour.
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
    // Not cached: there is no AI call to save, and the next logged set should
    // change the answer immediately.
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

  // Anchor on the *weight* record, which is what the PR list shows.
  // `best_set_weight` is the best-e1RM set's weight and can be lighter (77.5×10
  // beats 80×8 on e1RM), so anchoring there suggested a weight below one the
  // user has already lifted. Pre-backfill rows carry 0, hence the fall back to
  // best_set_*.
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
    console.error('predict AI failed:', e)
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
          // Only `generateSuggestion`'s hypertrophy branch resets the rep
          // target to 8 on a weight bump; without the focus, strength and
          // default users got a reset their reasoning text never mentioned.
          user.training_focus ?? null,
        ),
        reasoning: fallbackSuggestion.reason,
      },
      confidence: 'low',
      fallback_used: true,
      last_session: lastSessionData,
    }
    // Deliberately not cached: the fallback means the AI call failed (bad key,
    // provider outage), and the next request should retry rather than serve a
    // degraded answer for an hour.
  }

  return NextResponse.json(prediction)
})
