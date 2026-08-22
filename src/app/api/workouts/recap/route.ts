import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserAICredentials } from '@/lib/auth'
import { generateWorkoutRecap } from '@/lib/ai'
import { EXERCISE_MUSCLES } from '@/lib/exercise-muscles'
import { muscleToZone, ALL_ZONES } from '@/lib/muscle-zones'
import { setsVolume } from '@/lib/volume'
import { callAIProvider, withUser } from '@/lib/api-handler'

const DAY_MS = 86400000

export const GET = withUser(async (request, user) => {
  const { provider, apiKey, model } = getUserAICredentials(user)

  const daysParam = request.nextUrl.searchParams.get('days')
  const period = daysParam === '30' ? 30 : 7

  // The `period` *complete* previous UTC days — the same window the crons and
  // /analytics/insights use. The old current window was open-ended (`gte` only),
  // so it covered `period + 1` days and was compared against a `period`-day
  // previous window under a prompt that says "Period: 7 days"; the volume
  // delta it produced was structurally inflated.
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const startDate = new Date(todayStart.getTime() - period * DAY_MS)
  const prevStartDate = new Date(startDate.getTime() - period * DAY_MS)

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
      // Summarised below as `best_weight × best_weight_reps`, so it is the
      // weight record's clock that decides whether the PR falls in this window
      // — `last_improved_at` also moves on e1RM-only sessions.
      where: {
        user_id: user.id,
        best_weight_improved_at: { gte: startDate, lt: todayStart },
      },
    }),
  ])

  const calcVolume = (wks: typeof workouts) =>
    wks.reduce((sum, w) =>
      sum + w.exercises.reduce((es, e) => {
        const sets = e.sets as unknown as { reps: number; weight_kg: number | null }[]
        return es + setsVolume(sets)
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

  const prsSummary = prs
    .map(p => `${p.exercise_name}: ${p.best_weight}kg × ${p.best_weight_reps}`)
    .join(', ')

  const exerciseSummary = Object.entries(exerciseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `${name} (×${count})`)
    .join(', ')

  // Wrapped so a provider failure (bad key, outage) is the same 502 "check your
  // API key" the food/run routes return, instead of an opaque 500.
  const recap = await callAIProvider('workouts/recap', () =>
    generateWorkoutRecap(provider, apiKey, model, {
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
