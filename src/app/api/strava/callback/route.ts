import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { exchangeStravaCode, verifyStravaState } from '@/lib/strava'

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

    const telegramIdStr = verifyStravaState(state)
    if (!telegramIdStr) {
      return NextResponse.redirect(new URL('/profile/strava?error=invalid_state', request.url))
    }

    const telegramId = BigInt(telegramIdStr)
    const tokens = await exchangeStravaCode(code)

    await prisma.user.update({
      where: { telegram_id: telegramId },
      data: {
        strava_athlete_id: BigInt(tokens.athlete_id),
        strava_access_token: encrypt(tokens.access_token),
        strava_refresh_token: encrypt(tokens.refresh_token),
        strava_token_expires: tokens.expires_at,
        strava_scope: 'activity:read',
      },
    })

    return NextResponse.redirect(new URL('/profile/strava?success=true', request.url))
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(new URL('/profile/strava?error=exchange_failed', request.url))
  }
}
