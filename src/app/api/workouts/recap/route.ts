import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, getUserAICredentials } from '@/lib/auth'
import { generateWorkoutRecap } from '@/lib/ai'
import { EXERCISE_MUSCLES } from '@/lib/exercise-muscles'
import { muscleToZone, ALL_ZONES } from '@/lib/muscle-zones'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { provider, apiKey, model } = getUserAICredentials(user)

    const daysParam = request.nextUrl.searchParams.get('days')
    const period = daysParam === '30' ? 30 : 7

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)
    startDate.setUTCHours(0, 0, 0, 0)

    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - period)

    const [workouts, prevWorkouts, prs] = await Promise.all([
      prisma.workoutLog.findMany({
        where: { user_id: user.id, workout_date: { gte: startDate } },
        include: { exercises: { orderBy: { order: 'asc' } } },
        orderBy: { workout_date: 'desc' },
      }),
      prisma.workoutLog.findMany({
        where: { user_id: user.id, workout_date: { gte: prevStartDate, lt: startDate } },
        include: { exercises: true },
      }),
      prisma.progressSnapshot.findMany({
        where: { user_id: user.id, last_improved_at: { gte: startDate } },
      }),
    ])

    const calcVolume = (wks: typeof workouts) =>
      wks.reduce((sum, w) =>
        sum + w.exercises.reduce((es, e) => {
          const sets = e.sets as unknown as { reps: number; weight_kg: number | null }[]
          return es + sets.reduce((ss, s) => ss + s.reps * (s.weight_kg ?? 1), 0)
        }, 0), 0)

    const totalVolume = Math.round(calcVolume(workouts))
    const prevVolume = Math.round(calcVolume(prevWorkouts))

    const musclesHitSet = new Set<string>()
    const exerciseCounts: Record<string, number> = {}

    for (const w of workouts) {
      for (const ex of w.exercises) {
        const key = ex.exercise_name.toLowerCase()
        exerciseCounts[ex.exercise_name] = (exerciseCounts[ex.exercise_name] ?? 0) + 1
        const data = EXERCISE_MUSCLES[key]
        if (data) {
          for (const m of data.primary) {
            const zone = muscleToZone(m)
            if (zone) musclesHitSet.add(zone)
          }
        }
      }
    }

    const musclesHit = Array.from(musclesHitSet)
    const musclesMissed = ALL_ZONES.filter(z => !musclesHitSet.has(z))

    const prsSummary = prs.map(p => `${p.exercise_name}: ${p.best_set_weight}kg`).join(', ')

    const exerciseSummary = Object.entries(exerciseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => `${name} (×${count})`)
      .join(', ')

    const recap = await generateWorkoutRecap(provider, apiKey, model, {
      period,
      workoutCount: workouts.length,
      totalVolume,
      prevVolume,
      musclesHit,
      musclesMissed,
      prsSummary,
      exerciseSummary,
    })

    return NextResponse.json({ recap })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message === 'User not found') {
      return NextResponse.json({ detail: message }, { status: 404 })
    }
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    if (message.includes('No API key')) {
      return NextResponse.json({ detail: message }, { status: 403 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
