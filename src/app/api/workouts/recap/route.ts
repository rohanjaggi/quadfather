import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserAICredentials } from '@/lib/auth'
import { generateWorkoutRecap } from '@/lib/ai'
import { EXERCISE_MUSCLES } from '@/lib/exercise-muscles'
import { muscleToZones, ALL_ZONES } from '@/lib/muscle-zones'
import { calculateTotalVolume } from '@/lib/volume'
import { callAIProvider, withUser } from '@/lib/api-handler'
import { daysAgoStart } from '@/lib/day'

export const GET = withUser(async (request, user) => {
  const ai = getUserAICredentials(user)

  const daysParam = request.nextUrl.searchParams.get('days')
  const period = daysParam === '30' ? 30 : 7

  // The `period` complete previous days, the same window the crons and /analytics/insights use.
  const todayStart = daysAgoStart(0)
  const startDate = daysAgoStart(period)
  const prevStartDate = daysAgoStart(2 * period)

  const [workouts, prevWorkouts, prs] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { user_id: user.id, workout_date: { gte: startDate, lt: todayStart } },
      include: { exercises: { orderBy: { order: 'asc' } } },
      orderBy: { workout_date: 'desc' },
    }),
    prisma.workoutLog.findMany({
      where: { user_id: user.id, workout_date: { gte: prevStartDate, lt: startDate } },
      include: { exercises: true },
    }),
    prisma.progressSnapshot.findMany({
      // Summarised as `best_weight × best_weight_reps`, so the weight record's clock decides the window.
      where: {
        user_id: user.id,
        best_weight_improved_at: { gte: startDate, lt: todayStart },
      },
    }),
  ])

  const totalVolume = calculateTotalVolume(workouts)
  const prevVolume = calculateTotalVolume(prevWorkouts)

  const musclesHitSet = new Set<string>()
  const exerciseCounts: Record<string, number> = {}

  for (const w of workouts) {
    for (const ex of w.exercises) {
      const key = ex.exercise_name.toLowerCase()
      exerciseCounts[ex.exercise_name] = (exerciseCounts[ex.exercise_name] ?? 0) + 1
      const data = EXERCISE_MUSCLES[key]
      if (data) {
        for (const m of data.primary) {
          for (const zone of muscleToZones(m)) musclesHitSet.add(zone)
        }
      }
    }
  }

  const musclesHit = Array.from(musclesHitSet)
  const musclesMissed = ALL_ZONES.filter(z => !musclesHitSet.has(z))

  const prsSummary = prs
    .map(p => `${p.exercise_name}: ${p.best_weight}kg × ${p.best_weight_reps}`)
    .join(', ')

  const exerciseSummary = Object.entries(exerciseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `${name} (×${count})`)
    .join(', ')

  // Wrapped so a provider failure is the same 502 the food/run routes return.
  const recap = await callAIProvider('workouts/recap', () =>
    generateWorkoutRecap(ai, {
      period,
      workoutCount: workouts.length,
      totalVolume,
      prevVolume,
      musclesHit,
      musclesMissed,
      prsSummary,
      exerciseSummary,
    }),
  )

  return NextResponse.json({ recap })
})
