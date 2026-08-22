import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfUtcDay } from '@/lib/budget'
import {
  optionalInt,
  optionalString,
  parseJsonBody,
  requireNumber,
  unprocessable,
  withFlexibleUser,
  withUser,
} from '@/lib/api-handler'

/** `StepLog.steps` is an Int column; 1e12 used to overflow it with a 500. */
const MAX_STEPS = 200_000
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ]/

/**
 * Resolve the UTC calendar day a step count belongs to.
 *
 * Days are stored as UTC midnight (`@db.Date`), which is also how `GET` buckets
 * them and how `getDailyBudget` looks today's row up. For a datetime *with* an
 * offset (`2026-08-20T01:00:00+08:00`) the leading calendar date is the day the
 * user was actually in — converting the instant to UTC would file it under the
 * previous day, which is how a morning sync used to overwrite yesterday.
 */
function parseStepDate(value: unknown): Date {
  if (value === undefined || value === null || value === '') return startOfUtcDay()
  if (typeof value !== 'string') {
    throw unprocessable('date must be a YYYY-MM-DD or ISO-8601 date string')
  }

  const match = DATE_ONLY.exec(value) ?? DATE_TIME.exec(value)
  // Rejects `19/08/2026`, `Aug 20 2026`, … which used to reach Prisma as an
  // Invalid Date and 500.
  if (!match) throw unprocessable('date must be a YYYY-MM-DD or ISO-8601 date string')
  if (!DATE_ONLY.test(value) && Number.isNaN(new Date(value).getTime())) {
    throw unprocessable('date must be a YYYY-MM-DD or ISO-8601 date string')
  }

  const [, year, month, day] = match
  const utcDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  // `Date.UTC` rolls 2026-02-31 over into March — reject rather than silently
  // filing the steps under the wrong day.
  if (
    utcDay.getUTCFullYear() !== Number(year) ||
    utcDay.getUTCMonth() !== Number(month) - 1 ||
    utcDay.getUTCDate() !== Number(day)
  ) {
    throw unprocessable('date is not a real calendar date')
  }
  return utcDay
}

export const POST = withFlexibleUser(async (request, user) => {
  const body = await parseJsonBody(request)

  // Health exports occasionally send `8123.0`; round rather than reject, but
  // bound the value so it fits the Int column.
  const steps = Math.round(requireNumber(body.steps, 'steps', { min: 0, max: MAX_STEPS }))
  const targetDate = parseStepDate(body.date)
  const source = optionalString(body.source, 'source', { maxLength: 20 })?.trim() || 'shortcut'

  const key = { user_id_date: { user_id: user.id, date: targetDate } }

  // A day's step count only ever goes up — a later sync that reports fewer
  // steps is a partial read, not a correction. The guard lives in the UPDATE's
  // own WHERE clause rather than in a preceding `findUnique`, so two concurrent
  // Shortcut runs can't both read the old value and race to overwrite it.
  const raised = await prisma.stepLog.updateMany({
    where: { user_id: user.id, date: targetDate, steps: { lt: steps } },
    data: { steps, source, logged_at: new Date() },
  })

  if (raised.count > 0) {
    return NextResponse.json(await prisma.stepLog.findUniqueOrThrow({ where: key }), {
      status: 200,
    })
  }

  // Nothing was raised, which means either the day has no row yet or the stored
  // count already wins. `upsert` settles that atomically: the old
  // `findUnique` + `create` let two concurrent syncs both see no row and then
  // collide on `@@unique([user_id, date])`, failing the loser with a P2002 →
  // 409 even though its data was fine.
  const stepLog = await prisma.stepLog.upsert({
    where: key,
    create: { user_id: user.id, steps, date: targetDate, source },
    // The stored count stands, but `source` is still re-stamped so a re-sync
    // can correct a mislabelled row — the old update branch never wrote it.
    update: { source },
  })

  if (stepLog.steps > steps) {
    console.log(
      `[steps] Rejected lower value: incoming=${steps}, stored=${stepLog.steps}, date=${targetDate.toISOString()}`,
    )
  }

  return NextResponse.json(stepLog, { status: 200 })
})

export const GET = withUser(async (request, user) => {
  const daysParam = request.nextUrl.searchParams.get('days')
  const days = optionalInt(daysParam, 'days', { min: 1, max: 365 }) ?? 7

  // Exactly `days` UTC days ending today — this used to subtract `days` from
  // today and so returned `days + 1` buckets (today's row plus a full extra
  // day), which is why `getSteps(1)` could report yesterday's count as today's.
  const startDate = startOfUtcDay()
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1))

  const stepLogs = await prisma.stepLog.findMany({
    where: { user_id: user.id, date: { gte: startDate } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(stepLogs)
})
