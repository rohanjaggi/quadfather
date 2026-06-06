import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, getUserAICredentials } from '@/lib/auth'
import { generateWorkoutSuggestion } from '@/lib/ai'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { provider, apiKey, model } = getUserAICredentials(user)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [workouts, templates] = await Promise.all([
      prisma.workoutLog.findMany({
        where: { user_id: user.id, workout_date: { gte: sevenDaysAgo } },
        include: { exercises: true },
        orderBy: { workout_date: 'desc' },
      }),
      prisma.workoutTemplate.findMany({
        where: { user_id: user.id },
        select: { id: true, name: true },
      }),
    ])

    const recentWorkouts = workouts.map(w => ({
      name: w.name,
      date: w.workout_date.toISOString().split('T')[0],
      exercises: w.exercises.map(e => e.exercise_name),
    }))

    const result = await generateWorkoutSuggestion(provider, apiKey, model, {
      recentWorkouts,
      templates,
      fitnessGoal: user.fitness_goal ?? 'general fitness',
    })

    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    if (message.includes('No API key')) {
      return NextResponse.json({ detail: message }, { status: 400 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
