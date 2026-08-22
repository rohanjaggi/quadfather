import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { updateProgressAfterWorkout } from '@/lib/progress'
import { DEFAULT_BODYWEIGHT_KG } from '@/lib/constants'
import {
  withUser,
  parseJsonBody,
  optionalInt,
  optionalString,
  requireString,
  requireInt,
  unprocessable,
  parseDateParam,
} from '@/lib/api-handler'

interface IncomingSet {
  reps: number
  weight_kg: number | null
}

interface IncomingExercise {
  exercise_name: string
  exercise_id: number | null
  sets: IncomingSet[]
  order: number
}

/**
 * Validate the `exercises` payload. Everything that reaches Prisma is built
 * here, so a hostile/broken body can't smuggle extra JSON columns into
 * `ExerciseLog.sets` or blow up with a 500 on a type mismatch.
 */
function parseExercises(value: unknown): IncomingExercise[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw unprocessable('exercises must be a non-empty array')
  }
  if (value.length > 50) throw unprocessable('exercises must contain at most 50 entries')

  return value.map((raw, i) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw unprocessable(`exercises[${i}] must be an object`)
    }
    const ex = raw as Record<string, unknown>
    const name = requireString(ex.exercise_name, `exercises[${i}].exercise_name`, { maxLength: 100 })

    if (!Array.isArray(ex.sets) || ex.sets.length === 0) {
      throw unprocessable(`exercises[${i}].sets must be a non-empty array`)
    }
    if (ex.sets.length > 50) {
      throw unprocessable(`exercises[${i}].sets must contain at most 50 entries`)
    }

    const sets: IncomingSet[] = ex.sets.map((rawSet, j) => {
      if (rawSet === null || typeof rawSet !== 'object' || Array.isArray(rawSet)) {
        throw unprocessable(`exercises[${i}].sets[${j}] must be an object`)
      }
      const s = rawSet as Record<string, unknown>
      const reps = requireInt(s.reps, `exercises[${i}].sets[${j}].reps`, { min: 1, max: 1000 })
      const weightRaw = s.weight_kg
      let weight: number | null = null
      if (weightRaw !== null && weightRaw !== undefined && weightRaw !== '') {
        if (typeof weightRaw !== 'number' || !Number.isFinite(weightRaw)) {
          throw unprocessable(`exercises[${i}].sets[${j}].weight_kg must be a number or null`)
        }
        if (weightRaw < 0 || weightRaw > 1000) {
          throw unprocessable(`exercises[${i}].sets[${j}].weight_kg must be between 0 and 1000`)
        }
        weight = weightRaw
      }
      return { reps, weight_kg: weight }
    })

    return {
      exercise_name: name,
      exercise_id: optionalInt(ex.exercise_id, `exercises[${i}].exercise_id`, { min: 1 }) ?? null,
      sets,
      order: optionalInt(ex.order, `exercises[${i}].order`, { min: 0 }) ?? i,
    }
  })
}

export const GET = withUser(async (request, user) => {
  const dateParam = request.nextUrl.searchParams.get('date')
  const days = optionalInt(request.nextUrl.searchParams.get('days'), 'days', { min: 1, max: 365 }) ?? 30

  const where: Prisma.WorkoutLogWhereInput = { user_id: user.id }

  if (dateParam) {
    // Validate before building the range — `?date=abc` used to reach Prisma as
    // an Invalid Date and 500. The range is built from a bare `YYYY-MM-DD`, so
    // a full ISO timestamp is rejected too rather than silently becoming NaN.
    parseDateParam(dateParam, 'date')
    const start = new Date(dateParam + 'T00:00:00Z')
    const end = new Date(dateParam + 'T23:59:59.999Z')
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw unprocessable('date must be a valid YYYY-MM-DD date')
    }
    where.workout_date = { gte: start, lte: end }
  } else {
    // `?days=7` is seven calendar days *including today* — the convention
    // /steps and /runs/history already use. Subtracting `days` whole days from
    // today's UTC midnight returned `days + 1` days of workouts.
    const startDate = new Date()
    startDate.setUTCHours(0, 0, 0, 0)
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1))
    where.workout_date = { gte: startDate }
  }

  const workouts = await prisma.workoutLog.findMany({
    where,
    include: { exercises: { orderBy: { order: 'asc' } } },
    orderBy: { workout_date: 'desc' },
  })

  return NextResponse.json(workouts)
})

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request)

  // 200, not 100 — `WorkoutLog.name` is `VarChar(200)`, and template names that
  // fit the column were being rejected at 101 characters.
  const name = requireString(body.name, 'name', { maxLength: 200 })
  const exercises = parseExercises(body.exercises)
  const durationMinutes = optionalInt(body.duration_minutes, 'duration_minutes', { min: 0, max: 1440 })
  const notes = optionalString(body.notes, 'notes', { maxLength: 2000 })
  const source = optionalString(body.source, 'source', { maxLength: 20 })
  const templateId = optionalInt(body.template_id, 'template_id', { min: 1 })

  const rawDate = body.workout_date
  if (rawDate !== undefined && rawDate !== null && typeof rawDate !== 'string') {
    throw unprocessable('workout_date must be a valid date')
  }
  const workoutDate = parseDateParam(rawDate as string | null | undefined, 'workout_date')

  // A template id from another user would otherwise be linked straight in
  // (cross-user linkage, and a 500-shaped FK-violation oracle for ids that
  // don't exist at all).
  if (templateId !== undefined) {
    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, user_id: user.id },
      select: { id: true },
    })
    if (!template) throw unprocessable('template_id does not belong to this user')
  }

  const workout = await prisma.workoutLog.create({
    data: {
      user_id: user.id,
      name,
      template_id: templateId ?? null,
      duration_minutes: durationMinutes ?? null,
      calories_burned: estimateCalories(exercises, user.weight_kg),
      notes: notes ?? null,
      source: source ?? 'manual',
      workout_date: workoutDate ?? new Date(),
      exercises: {
        create: exercises.map(ex => ({
          exercise_name: ex.exercise_name,
          exercise_id: ex.exercise_id,
          sets: ex.sets as unknown as Prisma.InputJsonValue,
          order: ex.order,
        })),
      },
    },
    include: { exercises: { orderBy: { order: 'asc' } } },
  })

  // Single, awaited progress update — the PRs it detects are persisted on the
  // workout row so /analyse can read them instead of recomputing (which would
  // re-apply this session's sets to the snapshots a second time).
  // A failure here must not fail the request: the workout is already saved.
  let response: typeof workout = workout
  try {
    const { prs } = await updateProgressAfterWorkout(user.id, workout.id)
    response = await prisma.workoutLog.update({
      where: { id: workout.id },
      data: { prs: prs as unknown as Prisma.InputJsonValue },
      include: { exercises: { orderBy: { order: 'asc' } } },
    })
  } catch (err) {
    console.error('Progress update failed:', err)
  }

  return NextResponse.json(response, { status: 201 })
})

function estimateCalories(
  exercises: { exercise_name: string; sets: unknown[] }[],
  userWeightKg: number | null,
): number {
  const weight = userWeightKg ?? DEFAULT_BODYWEIGHT_KG
  const COMPOUND_EXERCISES = [
    'bench', 'squat', 'deadlift', 'press', 'row', 'pull-up', 'pullup',
    'chin-up', 'chinup', 'dip', 'clean', 'snatch', 'lunge', 'thrust',
  ]

  let totalCals = 0
  for (const ex of exercises) {
    const nameLower = ex.exercise_name.toLowerCase()
    const isCompound = COMPOUND_EXERCISES.some(c => nameLower.includes(c))
    const calPerSet = isCompound ? 0.05 * weight : 0.03 * weight
    totalCals += ex.sets.length * calPerSet
  }

  return Math.round(totalCals)
}
