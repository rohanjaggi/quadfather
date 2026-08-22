import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  withUser,
  parseJsonBody,
  parseDateParam,
  requireNumber,
  requireInt,
  optionalNumber,
  optionalString,
  unprocessable,
} from '@/lib/api-handler'

export const GET = withUser(async (request, user) => {
  const dateParam = request.nextUrl.searchParams.get('date')
  parseDateParam(dateParam, 'date')

  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10)
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    throw unprocessable('date must be a valid YYYY-MM-DD date')
  }

  const runs = await prisma.runLog.findMany({
    where: {
      user_id: user.id,
      run_date: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { run_date: 'desc' },
  })

  return NextResponse.json(runs.map(r => ({
    ...r,
    strava_activity_id: r.strava_activity_id?.toString() ?? null,
  })))
})

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request)

  // Every field is validated before it reaches Prisma — a string
  // `distance_meters` used to surface as a 500 from the driver.
  const distanceMeters = requireNumber(body.distance_meters, 'distance_meters', {
    min: 1,
    max: 1_000_000,
  })
  const durationSeconds = requireInt(body.duration_seconds, 'duration_seconds', {
    min: 1,
    max: 86_400 * 7,
  })
  const caloriesBurned = requireNumber(body.calories_burned, 'calories_burned', {
    min: 0,
    max: 100_000,
  })
  const pacePerKm = optionalNumber(body.pace_per_km, 'pace_per_km', { min: 0, max: 120 })
  const averageHeartrate = optionalNumber(body.average_heartrate, 'average_heartrate', {
    min: 0,
    max: 300,
  })
  const elevationGain = optionalNumber(body.elevation_gain, 'elevation_gain', {
    min: -1000,
    max: 30_000,
  })
  const name = optionalString(body.name, 'name', { maxLength: 200 })
  const source = optionalString(body.source, 'source', { maxLength: 20 })

  const rawDate = body.run_date
  if (rawDate !== undefined && rawDate !== null && typeof rawDate !== 'string') {
    throw unprocessable('run_date must be a valid date')
  }
  const runDate = parseDateParam(rawDate as string | null | undefined, 'run_date')

  const run = await prisma.runLog.create({
    data: {
      user_id: user.id,
      distance_meters: distanceMeters,
      duration_seconds: durationSeconds,
      calories_burned: caloriesBurned,
      pace_per_km: pacePerKm ?? Math.round(((durationSeconds / 60) / (distanceMeters / 1000)) * 100) / 100,
      average_heartrate: averageHeartrate ?? null,
      elevation_gain: elevationGain ?? null,
      name: name?.trim() || 'Run',
      source: source ?? 'manual',
      // Explicit rather than relying on the column default — the budget
      // calculation reads this flag and a wrong default would zero run credit.
      added_to_allowance: true,
      run_date: runDate ?? new Date(),
    },
  })

  return NextResponse.json({
    ...run,
    strava_activity_id: run.strava_activity_id?.toString() ?? null,
  }, { status: 201 })
})
