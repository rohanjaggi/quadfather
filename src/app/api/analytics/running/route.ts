import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, optionalInt } from '@/lib/api-handler'
import { EXERCISE_DAMPENING } from '@/lib/constants'
import { addDays, dayKey, daysAgoStart } from '@/lib/day'

export const GET = withUser(async (request, user) => {
  // `?days=abc` is NaN, which slips through the range check (every NaN comparison is false).
  const days =
    optionalInt(request.nextUrl.searchParams.get('days'), 'days', { min: 1, max: 90 }) ?? 7

  const today = dayKey()
  const runs = await prisma.runLog.findMany({
    where: {
      user_id: user.id,
      run_date: { gte: daysAgoStart(days - 1) },
    },
  })

  const byDate = new Map<string, typeof runs>()
  for (const run of runs) {
    const key = dayKey(run.run_date)
    const arr = byDate.get(key) ?? []
    arr.push(run)
    byDate.set(key, arr)
  }

  let totalDistance = 0
  let totalDuration = 0
  let totalCalories = 0
  // Raw burn of runs that feed the food budget (excludes `added_to_allowance` off); dampened once at the end to match `runs_credit`.
  let creditedRaw = 0
  let totalRuns = 0
  const result = []

  for (let i = days - 1; i >= 0; i--) {
    const dateKey = addDays(today, -i)
    const dayRuns = byDate.get(dateKey) ?? []

    const dayDistance = dayRuns.reduce((s, r) => s + r.distance_meters, 0)
    const dayDuration = dayRuns.reduce((s, r) => s + r.duration_seconds, 0)
    const dayCalories = dayRuns.reduce((s, r) => s + r.calories_burned, 0)
    const avgPace = dayDistance > 0
      ? Math.round(((dayDuration / 60) / (dayDistance / 1000)) * 100) / 100
      : undefined

    totalDistance += dayDistance
    totalDuration += dayDuration
    totalCalories += dayCalories
    creditedRaw += dayRuns
      .filter(r => r.added_to_allowance !== false)
      .reduce((s, r) => s + r.calories_burned, 0)
    totalRuns += dayRuns.length

    result.push({
      date: dateKey,
      total_distance: Math.round(dayDistance),
      total_duration: dayDuration,
      total_calories: Math.round(dayCalories),
      run_count: dayRuns.length,
      average_pace: avgPace,
    })
  }

  return NextResponse.json({
    days: result,
    totals: {
      distance: Math.round(totalDistance),
      duration: totalDuration,
      // Every run's reported burn, whether or not it counts toward food budget.
      calories: Math.round(totalCalories),
      // What those runs added to the food budget (dampened, flagged runs only), so it agrees with the dashboard.
      credited_calories: Math.round(creditedRaw * EXERCISE_DAMPENING),
      run_count: totalRuns,
    },
  })
})
