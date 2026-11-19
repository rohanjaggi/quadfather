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

  // Exactly `days` calendar days ending today. Subtracting `days` covered `days + 1`
  // calendar days, so `?days=7` returned an eighth day of runs and disagreed
  // with `/analytics/running?days=7` and `/steps?days=7` over the same window.
  const runs = await prisma.runLog.findMany({
    where: {
      user_id: user.id,
      run_date: { gte: daysAgoStart(days - 1) },
    },
    orderBy: { run_date: 'desc' },
  })

  return NextResponse.json(runs.map(serializeRun))
})
