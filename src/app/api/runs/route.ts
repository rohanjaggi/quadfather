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
import { dayKey, dayRange } from '@/lib/day'
import { serializeRun } from '@/lib/strava'

export const GET = withUser(async (request, user) => {
  const { start, end } = dayRange(dayKey(parseDateParam(request.nextUrl.searchParams.get('date'), 'date')))

  const runs = await prisma.runLog.findMany({
    where: {
      user_id: user.id,
      run_date: { gte: start, lt: end },
    },
    orderBy: { run_date: 'desc' },
  })

  return NextResponse.json(runs.map(serializeRun))
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
      pace_per_km: Math.round(((durationSeconds / 60) / (distanceMeters / 1000)) * 100) / 100,
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

  return NextResponse.json(serializeRun(run), { status: 201 })
})
