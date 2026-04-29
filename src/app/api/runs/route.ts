import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const dateParam = request.nextUrl.searchParams.get('date')

    let dayStart: Date
    if (dateParam) {
      dayStart = new Date(dateParam)
    } else {
      dayStart = new Date()
    }
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const runs = await prisma.runLog.findMany({
      where: {
        user_id: user.id,
        run_date: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { run_date: 'desc' },
    })

    return NextResponse.json(runs.map(r => ({
      ...r,
      strava_activity_id: r.strava_activity_id ? Number(r.strava_activity_id) : null,
    })))
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { distance_meters, duration_seconds, calories_burned, pace_per_km,
            average_heartrate, elevation_gain, name, source, run_date } = body

    if (!distance_meters || !duration_seconds || !calories_burned) {
      return NextResponse.json(
        { detail: 'distance_meters, duration_seconds, and calories_burned are required' },
        { status: 422 },
      )
    }

    const run = await prisma.runLog.create({
      data: {
        user_id: user.id,
        distance_meters,
        duration_seconds,
        calories_burned,
        pace_per_km: pace_per_km ?? (distance_meters > 0
          ? Math.round(((duration_seconds / 60) / (distance_meters / 1000)) * 100) / 100
          : null),
        average_heartrate,
        elevation_gain,
        name: name ?? 'Run',
        source: source ?? 'manual',
        run_date: run_date ? new Date(run_date) : new Date(),
      },
    })

    return NextResponse.json({
      ...run,
      strava_activity_id: run.strava_activity_id ? Number(run.strava_activity_id) : null,
    }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
