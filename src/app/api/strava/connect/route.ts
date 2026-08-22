import { NextResponse } from 'next/server'
import { withUser } from '@/lib/api-handler'
import { getStravaAuthUrl, signStravaState } from '@/lib/strava'

// The shared wrapper replaces a hand-rolled try/catch that echoed raw error
// text at 500 — a missing STRAVA_CLIENT_ID or a signing failure leaked its
// message straight to the client. Auth failures still map to 401.
export const GET = withUser(async (_request, user) => {
  const state = signStravaState(`${user.telegram_id}`)
  const url = getStravaAuthUrl(state)
  return NextResponse.json({ url })
})
