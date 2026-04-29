import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? ''
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? ''
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI ?? ''

export function signStravaState(telegramId: string): string {
  const key = process.env.ENCRYPTION_KEY ?? ''
  const sig = createHmac('sha256', key).update(telegramId).digest('hex').slice(0, 16)
  return `${telegramId}.${sig}`
}

export function verifyStravaState(state: string): string | null {
  const dot = state.indexOf('.')
  if (dot === -1) return null
  const telegramId = state.slice(0, dot)
  if (signStravaState(telegramId) !== state) return null
  return telegramId
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

export async function fetchStravaActivities(
  accessToken: string,
  after?: number,
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ per_page: '30' })
  if (after) params.set('after', after.toString())

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    throw new Error(`Strava API error: ${res.status}`)
  }
  const activities: StravaActivity[] = await res.json()
  return activities.filter(a =>
    a.type === 'Run' || a.sport_type === 'Run' ||
    a.sport_type === 'TrailRun' || a.sport_type === 'VirtualRun'
  )
}

export function stravaActivityToRunData(activity: StravaActivity) {
  const pacePerKm = activity.distance > 0
    ? (activity.moving_time / 60) / (activity.distance / 1000)
    : undefined

  return {
    strava_activity_id: BigInt(activity.id),
    distance_meters: activity.distance,
    duration_seconds: activity.moving_time,
    calories_burned: activity.calories || estimateCalories(activity.distance, activity.moving_time),
    pace_per_km: pacePerKm ? Math.round(pacePerKm * 100) / 100 : undefined,
    average_heartrate: activity.average_heartrate ?? undefined,
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
