import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqualStr } from '@/lib/api-handler'

/**
 * Shared authentication for the cron routes (GitHub Actions calls them with
 * `Authorization: Bearer $CRON_SECRET`).
 *
 * Two things this deliberately does differently from a plain `!==`:
 *
 *  - **Fails closed on misconfiguration.** With `CRON_SECRET` unset the old
 *    check compared against the literal `"Bearer "`, so anyone who guessed that
 *    header could trigger every user's AI spend. An unset secret is now a 500
 *    ("misconfigured"), never an open door.
 *  - **Constant-time compare**, so the secret can't be recovered a byte at a
 *    time from response timing.
 *
 * Returns a response to send when auth fails, or `null` when the caller is
 * authorised.
 */
export function checkCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET ?? ''

  if (!secret) {
    console.error('CRON_SECRET is not set — refusing to run the cron job')
    return NextResponse.json({ detail: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') ?? ''
  if (!timingSafeEqualStr(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  return null
}
