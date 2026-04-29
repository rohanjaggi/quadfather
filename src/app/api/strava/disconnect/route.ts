import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { getValidStravaToken, deauthorizeStrava } from '@/lib/strava'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    if (user.strava_access_token) {
      try {
        const token = await getValidStravaToken(user)
        await deauthorizeStrava(token)
      } catch {
        // Continue even if deauth fails — clear local tokens regardless
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        strava_athlete_id: null,
        strava_access_token: null,
        strava_refresh_token: null,
        strava_token_expires: null,
        strava_scope: null,
      },
    })

    return NextResponse.json({ disconnected: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
