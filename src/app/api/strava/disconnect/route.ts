import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser } from '@/lib/api-handler'
import { getValidStravaToken, deauthorizeStrava } from '@/lib/strava'

// The shared wrapper replaces a hand-rolled try/catch that echoed raw error
// text at 500 (Strava HTTP bodies, Prisma messages). Auth failures still map
// to 401; anything else collapses to a logged, generic `Internal error`.
export const POST = withUser(async (_request, user) => {
  if (user.strava_access_token) {
    try {
      const token = await getValidStravaToken(user)
      await deauthorizeStrava(token)
    } catch {
      // Best effort: a revoked/expired grant on Strava's side must not block
      // us from clearing our own copy of the tokens below.
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
