import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { timingSafeEqualStr } from '@/lib/api-handler'
import { findUserAICredentials } from '@/lib/auth'
import type { AICredentials } from '@/lib/models'

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

/**
 * Authenticate the cron, then run `send` for every AI-enabled user who has not
 * switched `pref` off in `ai_coaching_prefs` and has a key. `send` returns
 * whether a message went out. One user's failure is logged and never stops
 * the loop.
 */
export async function forEachCronUser(
  request: NextRequest,
  pref: string,
  label: string,
  send: (user: User, ai: AICredentials) => Promise<boolean>,
): Promise<NextResponse> {
  const authFailure = checkCronAuth(request)
  if (authFailure) return authFailure

  const users = await prisma.user.findMany({
    where: { ai_features_enabled: true },
  })

  let sent = 0
  for (const user of users) {
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null
    if (coachPrefs?.[pref] === false) continue

    try {
      // Inside the per-user try: the lookup decrypts the stored key, which
      // throws on a rotated ENCRYPTION_KEY, a corrupt ciphertext, or a legacy
      // plaintext key — that must not stop everyone else's digest.
      const ai = findUserAICredentials(user)
      if (ai && (await send(user, ai))) sent++
    } catch (err) {
      console.error(`${label} failed for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: users.length })
}
