import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDays, dayKey } from '@/lib/day'
import {
  optionalInt,
  optionalString,
  parseJsonBody,
  requireNumber,
  unprocessable,
  withFlexibleUser,
  withUser,
} from '@/lib/api-handler'

/** `StepLog.steps` is an Int column. */
const MAX_STEPS = 200_000
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ]/

/**
 * Resolve the calendar day a step count belongs to (default: today, Singapore). Stored as UTC
 * midnight of the `YYYY-MM-DD` key (`@db.Date`); for a datetime with an offset the leading
 * date is the user's day, since converting to UTC would file it under the previous one.
 */
function parseStepDate(value: unknown): Date {
  if (value === undefined || value === null || value === '') return new Date(`${dayKey()}T00:00:00Z`)
  if (typeof value !== 'string') {
    throw unprocessable('date must be a YYYY-MM-DD or ISO-8601 date string')
  }

  const match = DATE_ONLY.exec(value) ?? DATE_TIME.exec(value)
  // Reject non-ISO forms (`19/08/2026`) that would reach Prisma as an Invalid Date.
  if (!match) throw unprocessable('date must be a YYYY-MM-DD or ISO-8601 date string')
  if (!DATE_ONLY.test(value) && Number.isNaN(new Date(value).getTime())) {
    throw unprocessable('date must be a YYYY-MM-DD or ISO-8601 date string')
  }

  const [, year, month, day] = match
  const utcDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  // `Date.UTC` rolls 2026-02-31 into March.
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

  // Health exports send `8123.0`; round, and bound to fit the Int column.
  const steps = Math.round(requireNumber(body.steps, 'steps', { min: 0, max: MAX_STEPS }))
  const targetDate = parseStepDate(body.date)
  const source = optionalString(body.source, 'source', { maxLength: 20 })?.trim() || 'shortcut'

  const key = { user_id_date: { user_id: user.id, date: targetDate } }

  // A day's count only goes up: a lower sync is a partial read. The guard is in the UPDATE's
  // WHERE so concurrent Shortcut runs can't race on a prior read.
  const raised = await prisma.stepLog.updateMany({
    where: { user_id: user.id, date: targetDate, steps: { lt: steps } },
    data: { steps, source, logged_at: new Date() },
  })

  if (raised.count > 0) {
    return NextResponse.json(await prisma.stepLog.findUniqueOrThrow({ where: key }), {
      status: 200,
    })
  }

  // Either no row yet or the stored count wins; `upsert` settles it atomically (a find+create
  // would P2002 on `@@unique([user_id, date])`).
  const stepLog = await prisma.stepLog.upsert({
    where: key,
    create: { user_id: user.id, steps, date: targetDate, source },
    // The stored count stands, but `source` is re-stamped so a re-sync can fix a mislabelled row.
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

  // Exactly `days` calendar days ending today, compared by the stored date key.
  const startDate = new Date(`${addDays(dayKey(), -(days - 1))}T00:00:00Z`)

  const stepLogs = await prisma.stepLog.findMany({
    where: { user_id: user.id, date: { gte: startDate } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(stepLogs)
})
