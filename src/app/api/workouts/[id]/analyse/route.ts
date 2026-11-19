import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserAICredentials } from '@/lib/auth'
import { generateWorkoutAnalysis } from '@/lib/ai'
import { escapeHtml } from '@/lib/html'
import { withUser, requireInt, notFound, ApiError, callAIProvider } from '@/lib/api-handler'
import { sendHtml } from '@/lib/telegram-bot'
import type { WorkoutAnalysis } from '@/types/exercises'

type Ctx = { params: { id: string } }

type PrEntry = { exercise: string; type: 'weight' | 'reps'; value: string }

/** Shape-check an analysis before it is persisted or served; a failure counts as "no analysis" and is regenerated. */
function isValidAnalysis(value: unknown): value is WorkoutAnalysis {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const a = value as Record<string, unknown>

  if (typeof a.volume_comparison !== 'string' || a.volume_comparison.trim() === '') return false
  if (typeof a.takeaway !== 'string' || a.takeaway.trim() === '') return false

  if (!Array.isArray(a.muscle_groups_hit)) return false
  if (!a.muscle_groups_hit.every(m => typeof m === 'string')) return false

  if (!Array.isArray(a.prs)) return false
  return a.prs.every(p => {
    if (p === null || typeof p !== 'object' || Array.isArray(p)) return false
    const pr = p as Record<string, unknown>
    return (
      typeof pr.exercise === 'string' &&
      typeof pr.value === 'string' &&
      (pr.type === 'weight' || pr.type === 'reps')
    )
  })
}

export const POST = withUser<Ctx>(async (request, user, { params }) => {
  const workoutId = requireInt(params.id, 'id')

  const workout = await prisma.workoutLog.findFirst({
    where: { id: workoutId, user_id: user.id },
    include: { exercises: { orderBy: { order: 'asc' } } },
  })

  if (!workout) throw notFound('Workout not found')

  // A malformed cached analysis is treated as missing, not served for the life of the row.
  if (workout.analysis && isValidAnalysis(workout.analysis)) {
    return NextResponse.json(workout.analysis)
  }

  const ai = getUserAICredentials(user)

  // PRs are computed once, when the workout is logged (POST /api/workouts), and
  // persisted on the row. This route is read-only w.r.t. progress snapshots.
  const prs: PrEntry[] = Array.isArray(workout.prs)
    ? (workout.prs as unknown as PrEntry[])
    : []

  const snapshots = await prisma.progressSnapshot.findMany({
    where: {
      user_id: user.id,
      exercise_name: { in: workout.exercises.map(e => e.exercise_name) },
    },
  })

  const progressContext = snapshots.map(s =>
    `${s.exercise_name}: 1RM=${s.estimated_1rm}kg, ${s.sessions_since_improvement === 0 ? 'just improved' : `${s.sessions_since_improvement} sessions since improvement`}`
  ).join('\n') || 'No prior history'

  // Wrapped so a provider failure is the same 502 the food/run routes return; `ApiError` passes through.
  const analysis = await callAIProvider('workouts/analyse', () =>
    generateWorkoutAnalysis(ai, {
      workoutName: workout.name,
      exercises: workout.exercises.map(e => ({
        name: e.exercise_name,
        sets: e.sets as unknown as { reps: number; weight_kg: number | null }[],
      })),
      progressContext,
      trainingFocus: user.training_focus ?? 'general fitness',
      prs: prs.map(p => ({ exercise_name: p.exercise, type: p.type, value: p.value })),
    }),
  )

  // The persisted `workout.prs` is authoritative (the model can drop or invent entries); overwrite before anything reads `analysis.prs`.
  analysis.prs = prs.map(p => ({ exercise: p.exercise, type: p.type, value: p.value }))

  // Belt and braces on top of `ai.ts` validation.
  if (!isValidAnalysis(analysis)) {
    console.error('Discarded invalid workout analysis for workout', workoutId, analysis)
    throw new ApiError(502, 'AI returned an invalid analysis — try again')
  }

  await prisma.workoutLog.update({
    where: { id: workoutId },
    data: { analysis: analysis as unknown as Prisma.InputJsonValue },
  })

  const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null
  if (coachPrefs?.workout_analysis !== false) {
    try {
      const prsText = analysis.prs.length > 0
        ? `\n🏆 ${analysis.prs.map(p => `${escapeHtml(p.exercise)}: ${escapeHtml(p.value)}`).join(', ')}`
        : ''
      const msg = `💪 <b>${escapeHtml(workout.name)}</b>\n\n${escapeHtml(analysis.volume_comparison)}${prsText}\n\n${escapeHtml(analysis.takeaway)}`
      await sendHtml(user.telegram_id, msg)
    } catch (err) {
      console.error('Failed to send workout analysis via Telegram:', err)
    }
  }

  return NextResponse.json(analysis)
})
