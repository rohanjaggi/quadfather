import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, optionalInt } from '@/lib/api-handler'
import { EXERCISE_DAMPENING } from '@/lib/constants'

export const GET = withUser(async (request, user) => {
  // `?days=abc` used to parse to NaN, which slips through `days < 1 || days > 90`
  // (every NaN comparison is false) and produced an all-Invalid-Date window.
  const days =
    optionalInt(request.nextUrl.searchParams.get('days'), 'days', { min: 1, max: 90 }) ?? 7

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1))
  const endDate = new Date(today)
  endDate.setUTCHours(23, 59, 59, 999)

  const runs = await prisma.runLog.findMany({
    where: {
      user_id: user.id,
      run_date: { gte: startDate, lte: endDate },
    },
  })

  const byDate = new Map<string, typeof runs>()
  for (const run of runs) {
    const key = new Date(run.run_date).toISOString().split('T')[0]
    const arr = byDate.get(key) ?? []
    arr.push(run)
    byDate.set(key, arr)
  }

  let totalDistance = 0
  let totalDuration = 0
  let totalCalories = 0
  // Raw burn of the runs that actually feed the food budget — excludes the ones
  // the user switched off via `PATCH /runs/:id`. Dampened once at the end so the
  // rounding matches `computeDailyBudget`'s `runs_credit` exactly.
  let creditedRaw = 0
  let totalRuns = 0
  const result = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const dateKey = d.toISOString().split('T')[0]
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
      // What those runs actually added to the food budget: dampened, and only
      // the runs still flagged `added_to_allowance`. The burn summary shows
      // this, so it can't disagree with the dashboard's remaining calories.
      credited_calories: Math.round(creditedRaw * EXERCISE_DAMPENING),
      run_count: totalRuns,
    },
  })
})
