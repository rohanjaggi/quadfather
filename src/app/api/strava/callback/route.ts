import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { timingSafeEqualStr } from '@/lib/api-handler'
import { exchangeStravaCode, signStravaState, hasActivityReadScope } from '@/lib/strava'

export const dynamic = 'force-dynamic'

/**
 * Verify the OAuth `state` that `/api/strava/connect` handed to Strava.
 *
 * Same format and same signature as `signStravaState` produces
 * (`<telegramId>.<hmac-sha256(ENCRYPTION_KEY, telegramId) truncated to 16 hex>`)
 * — with two hardening properties:
 *
 *  - **constant-time**, so the expected signature can't be recovered a
 *    character at a time by timing the callback; and
 *  - **rejects an empty `ENCRYPTION_KEY`** instead of signing with the empty
 *    key, which anyone could reproduce and so forge a `state` for any
 *    Telegram id — this route writes Strava tokens onto whichever user that
 *    id names.
 *
 * Returns the Telegram id as a string, or `null` when the state is not ours.
 */
function verifyState(state: string): string | null {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('Strava callback: ENCRYPTION_KEY is not set — rejecting state')
    return null
  }
  const dot = state.indexOf('.')
  if (dot === -1) return null
  const telegramId = state.slice(0, dot)
  if (!telegramId || !/^\d+$/.test(telegramId)) return null
  if (!timingSafeEqualStr(signStravaState(telegramId), state)) return null
  return telegramId
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL('/profile/strava?error=denied', request.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/profile/strava?error=missing_params', request.url))
    }

    const telegramIdStr = verifyState(state)
    if (!telegramIdStr) {
      return NextResponse.redirect(new URL('/profile/strava?error=invalid_state', request.url))
    }

    const telegramId = BigInt(telegramIdStr)
    // Strava reports what the athlete actually granted (comma-separated, e.g.
    // `read,activity:read_all`) — they can untick scopes on the consent screen.
    const grantedScope = request.nextUrl.searchParams.get('scope') ?? ''
    const tokens = await exchangeStravaCode(code)

    // Store the tokens either way (so a later re-auth upgrades in place and the
    // disconnect flow can still deauthorize), but record the real scope so sync
    // can refuse up front instead of failing with a Strava 401.
    await prisma.user.update({
      where: { telegram_id: telegramId },
      data: {
        strava_athlete_id: BigInt(tokens.athlete_id),
        strava_access_token: encrypt(tokens.access_token),
        strava_refresh_token: encrypt(tokens.refresh_token),
        strava_token_expires: tokens.expires_at,
        strava_scope: grantedScope,
      },
    })

    if (!hasActivityReadScope(grantedScope)) {
      return NextResponse.redirect(
        new URL('/profile/strava?error=insufficient_scope', request.url),
      )
    }

    return NextResponse.redirect(new URL('/profile/strava?success=true', request.url))
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(new URL('/profile/strava?error=exchange_failed', request.url))
  }
}
