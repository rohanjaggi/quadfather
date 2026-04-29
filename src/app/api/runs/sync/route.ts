import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { getValidStravaToken, fetchStravaActivities, stravaActivityToRunData } from '@/lib/strava'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (!user.strava_access_token) {
      return NextResponse.json({ detail: 'Strava not connected' }, { status: 400 })
    }

    const token = await getValidStravaToken(user)

    const lastSync = await prisma.runLog.findFirst({
      where: { user_id: user.id, source: 'strava' },
      orderBy: { run_date: 'desc' },
    })

    const after = lastSync
      ? Math.floor(new Date(lastSync.run_date).getTime() / 1000)
      : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

    const activities = await fetchStravaActivities(token, after)

    let synced = 0
    for (const activity of activities) {
      const exists = await prisma.runLog.findUnique({
        where: { strava_activity_id: BigInt(activity.id) },
      })
      if (exists) continue

      const runData = stravaActivityToRunData(activity)
      await prisma.runLog.create({
        data: { user_id: user.id, ...runData },
      })
      synced++
    }

    return NextResponse.json({ synced, total_fetched: activities.length })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message === 'Strava not connected') {
      return NextResponse.json({ detail: message }, { status: 400 })
    }
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    console.error('Strava sync error:', e)
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
