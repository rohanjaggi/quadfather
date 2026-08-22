import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? ''
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? ''
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI ?? ''

/**
 * Sign the OAuth `state` handed to Strava. Used by `/api/strava/connect` to
 * mint it and by `/api/strava/callback` to re-derive and compare it.
 *
 * There is deliberately no `verifyStravaState` here: the only verifier lives in
 * the callback route, which compares in constant time and refuses to run at all
 * when `ENCRYPTION_KEY` is unset. The variant that used to sit here did neither,
 * so anyone could sign a state for any Telegram id on a deployment with no key.
 */
export function signStravaState(telegramId: string): string {
  const key = process.env.ENCRYPTION_KEY ?? ''
  const sig = createHmac('sha256', key).update(telegramId).digest('hex').slice(0, 16)
  return `${telegramId}.${sig}`
}

/**
 * Strava returns the granted scopes as a comma-separated list on the OAuth
 * callback (e.g. `read,activity:read_all`). Reading activities requires either
 * `activity:read` or `activity:read_all`; anything less means the athlete
 * activity endpoints will 401.
 */
export function hasActivityReadScope(scope: string | null | undefined): boolean {
  if (!scope) return false
  return scope
    .split(/[,\s]+/)
    .map(s => s.trim())
    .some(s => s === 'activity:read' || s === 'activity:read_all')
}

export function getStravaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    scope: 'activity:read',
    approval_prompt: 'auto',
    state,
  })
  return `https://www.strava.com/oauth/authorize?${params.toString()}`
}

export async function exchangeStravaCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_at: number
  athlete_id: number
}> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava token exchange failed: ${text}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete.id,
  }
}

async function refreshStravaToken(userId: number, refreshToken: string): Promise<string> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    throw new Error('Strava token refresh failed')
  }
  const data = await res.json()

  await prisma.user.update({
    where: { id: userId },
    data: {
      strava_access_token: encrypt(data.access_token),
      strava_refresh_token: encrypt(data.refresh_token),
      strava_token_expires: data.expires_at,
    },
  })

  return data.access_token
}

export async function getValidStravaToken(user: {
  id: number
  strava_access_token: string | null
  strava_refresh_token: string | null
  strava_token_expires: number | null
}): Promise<string> {
  if (!user.strava_access_token || !user.strava_refresh_token) {
    throw new Error('Strava not connected')
  }

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = user.strava_token_expires ?? 0

  if (now < expiresAt - 300) {
    return decrypt(user.strava_access_token)
  }

  const decryptedRefresh = decrypt(user.strava_refresh_token)
  return refreshStravaToken(user.id, decryptedRefresh)
}

interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  average_speed: number
  max_speed: number
  average_heartrate?: number
  max_heartrate?: number
  calories: number
  start_date: string
  start_date_local: string
}

const ACTIVITIES_PER_PAGE = 30
/** Safety stop so a misbehaving API response can never spin the loop forever. */
const MAX_ACTIVITY_PAGES = 100

/**
 * @param after epoch **seconds in real UTC** — Strava filters on the activity's
 *   `start_date` (UTC), so never derive this from a local wall-clock value.
 */
export async function fetchAllStravaActivities(
  accessToken: string,
  after?: number,
): Promise<StravaActivity[]> {
  const all: StravaActivity[] = []
  for (let page = 1; page <= MAX_ACTIVITY_PAGES; page++) {
    const params = new URLSearchParams({
      per_page: String(ACTIVITIES_PER_PAGE),
      page: String(page),
    })
    if (after && after > 0) params.set('after', Math.floor(after).toString())
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) {
      throw new Error(`Strava API error: ${res.status}`)
    }
    const activities: StravaActivity[] = await res.json()
    if (activities.length === 0) break
    all.push(...activities.filter(a =>
      a.type === 'Run' || a.sport_type === 'Run' ||
      a.sport_type === 'TrailRun' || a.sport_type === 'VirtualRun'
    ))
    // A short page is the last page — saves one round trip and guarantees exit.
    if (activities.length < ACTIVITIES_PER_PAGE) break
  }
  return all
}

export function stravaActivityToRunData(activity: StravaActivity) {
  const pacePerKm = activity.distance > 0
    ? (activity.moving_time / 60) / (activity.distance / 1000)
    : null

  // Explicit `null` rather than `undefined`: these rows are inserted with
  // `createMany`, which is happiest when every row carries the same key set.
  return {
    strava_activity_id: BigInt(activity.id),
    distance_meters: activity.distance,
    duration_seconds: activity.moving_time,
    calories_burned: activity.calories || estimateCalories(activity.distance, activity.moving_time),
    pace_per_km: pacePerKm ? Math.round(pacePerKm * 100) / 100 : null,
    average_heartrate: activity.average_heartrate ?? null,
    elevation_gain: activity.total_elevation_gain,
    name: activity.name,
    source: 'strava' as const,
    run_date: new Date(activity.start_date_local),
  }
}

function estimateCalories(distanceMeters: number, durationSeconds: number): number {
  const km = distanceMeters / 1000
  return Math.round(km * 70)
}

export async function deauthorizeStrava(accessToken: string): Promise<void> {
  await fetch('https://www.strava.com/oauth/deauthorize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
