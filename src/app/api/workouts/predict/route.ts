import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getUserAICredentials } from '@/lib/auth'
import { getModelForProvider } from '@/lib/models'
import { generateSuggestion } from '@/lib/progress'
import { fetchExerciseHistory, formatHistory, buildPredictPrompt, parsePredictionResponse } from '@/lib/predict'
import { callTextDirect } from '@/lib/ai'
import { prisma } from '@/lib/prisma'
import type { PredictionData } from '@/types/exercises'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const exerciseName = request.nextUrl.searchParams.get('exercise_name')

    if (!exerciseName) {
      return NextResponse.json({ detail: 'exercise_name is required' }, { status: 422 })
    }

    const snapshot = await prisma.progressSnapshot.findUnique({
      where: {
        user_id_exercise_name: {
          user_id: user.id,
          exercise_name: exerciseName,
        },
      },
    })

    const history = await fetchExerciseHistory(user.id, exerciseName)

    if (!snapshot || history.length === 0) {
      return NextResponse.json({
        prediction: null,
        confidence: 'low',
        fallback_used: true,
        last_session: null,
      } satisfies PredictionData)
    }

    const lastSession = history[0]
    const lastSessionData = {
      date: lastSession.workout_date.toISOString().split('T')[0],
      sets: lastSession.sets,
    }

    let prediction: PredictionData
    try {
      const { provider, apiKey, model } = getUserAICredentials(user)
      const resolvedModel = getModelForProvider(provider, model)

      const prompt = buildPredictPrompt({
        exerciseName,
        fitnessGoal: user.fitness_goal ?? null,
        trainingFocus: user.training_focus ?? null,
        weightKg: user.weight_kg ? Number(user.weight_kg) : null,
        history: formatHistory(history),
        estimated1rm: snapshot.estimated_1rm,
        bestSetWeight: snapshot.best_set_weight,
        bestSetReps: snapshot.best_set_reps,
        sessionsSinceImprovement: snapshot.sessions_since_improvement,
        totalVolume7d: snapshot.total_volume_7d,
      })

      const raw = await callTextDirect(provider, apiKey, resolvedModel, prompt)
      const result = parsePredictionResponse(raw)

      const confidence = history.length >= 5 ? 'high' : history.length >= 3 ? 'medium' : 'low'

      prediction = {
        prediction: result,
        confidence,
        fallback_used: false,
        last_session: lastSessionData,
      }
    } catch {
      const fallbackSuggestion = generateSuggestion(
        user.training_focus ?? null,
        snapshot.best_set_weight,
        snapshot.best_set_reps,
        snapshot.sessions_since_improvement,
        lastSession.sets,
      )

      prediction = {
        prediction: {
          sets: [{ reps: snapshot.best_set_reps, weight_kg: snapshot.best_set_weight }],
          reasoning: fallbackSuggestion.reason,
        },
        confidence: 'low',
        fallback_used: true,
        last_session: lastSessionData,
      }
    }

    return NextResponse.json(prediction)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
