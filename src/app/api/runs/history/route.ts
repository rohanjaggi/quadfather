import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, optionalInt } from '@/lib/api-handler'
import { daysAgoStart } from '@/lib/day'
import { serializeRun } from '@/lib/strava'

export const GET = withUser(async (request, user) => {
  const days = optionalInt(request.nextUrl.searchParams.get('days'), 'days', {
    min: 1,
    max: 90,
  }) ?? 30

  // Exactly `days` calendar days ending today, matching `/analytics/running` and `/steps`.
  const runs = await prisma.runLog.findMany({
    where: {
      user_id: user.id,
      run_date: { gte: daysAgoStart(days - 1) },
    },
    orderBy: { run_date: 'desc' },
  })

  return NextResponse.json(runs.map(serializeRun))
})
