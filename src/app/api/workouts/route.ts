import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const days = parseInt(request.nextUrl.searchParams.get('days') ?? '30', 10)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setUTCHours(0, 0, 0, 0)

    const workouts = await prisma.workoutLog.findMany({
      where: {
        user_id: user.id,
        workout_date: { gte: startDate },
      },
      include: { exercises: { orderBy: { order: 'asc' } } },
      orderBy: { workout_date: 'desc' },
    })

    return NextResponse.json(workouts)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { name, template_id, duration_minutes, notes, source, exercises, workout_date } = body

    if (!name || !Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json(
        { detail: 'name and exercises (non-empty array) are required' },
        { status: 422 },
      )
    }

    const workout = await prisma.workoutLog.create({
      data: {
        user_id: user.id,
        name,
        template_id: template_id ?? null,
        duration_minutes: duration_minutes ?? null,
        calories_burned: estimateCalories(exercises, user.weight_kg),
        notes: notes ?? null,
        source: source ?? 'manual',
        workout_date: workout_date ? new Date(workout_date) : new Date(),
        exercises: {
          create: exercises.map((ex: { exercise_name: string; sets: { reps: number; weight_kg: number | null }[]; order: number }) => ({
            exercise_name: ex.exercise_name,
            sets: ex.sets as unknown as import('@prisma/client').Prisma.InputJsonValue,
            order: ex.order,
          })),
        },
      },
      include: { exercises: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json(workout, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

function estimateCalories(
  exercises: { exercise_name: string; sets: { reps: number; weight_kg: number | null }[] }[],
  userWeightKg: number | null,
): number {
  const weight = userWeightKg ?? 70
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
