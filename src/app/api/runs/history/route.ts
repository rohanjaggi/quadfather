import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, optionalInt } from '@/lib/api-handler'

export const GET = withUser(async (request, user) => {
  const days = optionalInt(request.nextUrl.searchParams.get('days'), 'days', {
    min: 1,
    max: 90,
  }) ?? 30

  // Exactly `days` UTC days ending today. Subtracting `days` covered `days + 1`
  // calendar days, so `?days=7` returned an eighth day of runs and disagreed
  // with `/analytics/running?days=7` and `/steps?days=7` over the same window.
  const startDate = new Date()
  startDate.setUTCHours(0, 0, 0, 0)
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1))

  const runs = await prisma.runLog.findMany({
    where: {
      user_id: user.id,
      run_date: { gte: startDate },
    },
    orderBy: { run_date: 'desc' },
  })

  return NextResponse.json(runs.map(r => ({
    ...r,
    strava_activity_id: r.strava_activity_id?.toString() ?? null,
  })))
})
