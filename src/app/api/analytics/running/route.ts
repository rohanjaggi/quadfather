import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    const daysParam = request.nextUrl.searchParams.get('days') ?? '7'
    const days = parseInt(daysParam, 10)
    if (days < 1 || days > 90) {
      return NextResponse.json({ detail: 'days must be between 1 and 90' }, { status: 400 })
    }

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
        calories: Math.round(totalCalories),
        run_count: totalRuns,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message === 'User not found') {
      return NextResponse.json({ detail: message }, { status: 404 })
    }
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
