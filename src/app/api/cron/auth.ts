import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { timingSafeEqualStr } from '@/lib/api-handler'
import { findUserAICredentials } from '@/lib/auth'
import type { AICredentials } from '@/lib/models'

/**
 * Shared auth for the cron routes (`Authorization: Bearer $CRON_SECRET`). Fails closed with a
 * 500 when `CRON_SECRET` is unset, and compares in constant time. Returns a response to
 * send on failure, or `null` when authorised.
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
 * Authenticate the cron, then run `send` for every AI-enabled user with a key who hasn't
 * switched `pref` off. `send` returns whether a message went out; one user's failure never
 * stops the loop.
 */
export async function forEachCronUser(
  request: NextRequest,
  pref: string,
  label: string,
  send: (user: User, ai: AICredentials) => Promise<boolean>,
): Promise<NextResponse> {
  const authFailure = checkCronAuth(request)
  if (authFailure) return authFailure

  // Fail before any AI spend: without a token every send would throw only after the user's AI call was paid for.
  if (!process.env.BOTFATHER_TOKEN) {
    console.error('BOTFATHER_TOKEN is not set — refusing to run the cron job')
    return NextResponse.json({ detail: 'Server misconfigured' }, { status: 500 })
  }

  const users = await prisma.user.findMany({
    where: { ai_features_enabled: true },
  })

  let sent = 0
  for (const user of users) {
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null
    if (coachPrefs?.[pref] === false) continue

    try {
      // Inside the per-user try: decrypting the stored key throws on a rotated ENCRYPTION_KEY or corrupt ciphertext.
      const ai = findUserAICredentials(user)
      if (ai && (await send(user, ai))) sent++
    } catch (err) {
      console.error(`${label} failed for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: users.length })
}
