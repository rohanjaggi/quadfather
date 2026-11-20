import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { timingSafeEqualStr } from '@/lib/api-handler'
import { exchangeStravaCode, signStravaState, hasActivityReadScope } from '@/lib/strava'

export const dynamic = 'force-dynamic'

/**
 * Verify the OAuth `state` from `/api/strava/connect` (same format as `signStravaState`):
 * constant-time, and rejects an empty `ENCRYPTION_KEY` (anyone could forge a state, and this
 * route writes Strava tokens onto the user it names). Returns the Telegram id or `null`.
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
    // Athletes can untick scopes on the consent screen, so record what was granted.
    const grantedScope = request.nextUrl.searchParams.get('scope') ?? ''
    const tokens = await exchangeStravaCode(code)

    // Store tokens either way (re-auth upgrades in place, disconnect can deauthorize); the real scope lets sync refuse up front.
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
