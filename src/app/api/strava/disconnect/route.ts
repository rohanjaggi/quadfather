import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser } from '@/lib/api-handler'
import { getValidStravaToken, deauthorizeStrava } from '@/lib/strava'

// The shared wrapper keeps raw error text (Strava bodies, Prisma messages) out of 500s.
export const POST = withUser(async (_request, user) => {
  if (user.strava_access_token) {
    try {
      const token = await getValidStravaToken(user)
      await deauthorizeStrava(token)
    } catch {
      // Best effort: a revoked grant on Strava's side must not block clearing our tokens.
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
      strava_last_synced_at: null,
    },
  })

  return NextResponse.json({ disconnected: true })
})
