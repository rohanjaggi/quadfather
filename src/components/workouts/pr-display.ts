import type { WorkoutPR } from '@/lib/api'

/**
 * `/api/workouts/prs` reports an unknown improvement date as `null`, which
 * `new Date(...)` turns into "Invalid Date". Render an em dash instead.
 *
 * The date arrives as a bare `YYYY-MM-DD`, which `new Date()` reads as UTC
 * midnight; formatting that in local time renders the previous day anywhere
 * west of UTC. Parse and format in UTC so the calendar day survives the trip.
 */
export function prDisplayDate(
  pr: WorkoutPR,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!pr.date) return '—'
  const parsed = new Date(pr.date.includes('T') ? pr.date : `${pr.date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
}

/** PR values are pre-formatted text (`100kg × 5`); shown as-is, with a space before the unit. */
export function prDisplayValue(pr: WorkoutPR): string {
  const value: unknown = pr.value
  return value == null ? '—' : String(value).replace(/(\d)kg\b/, '$1 kg')
}

/**
 * Estimated 1RM of the record set, from the `100kg × 5` value the route sends.
 * Same Epley formula as `calculateEstimated1RM` in `lib/progress.ts` (which
 * can't be imported here: it pulls in Prisma). It is the e1RM *of this set*;
 * the route doesn't send the stored best e1RM, which may come from a lighter set.
 * Null when the value doesn't parse.
 */
export function prEstimated1RM(pr: WorkoutPR): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*kg\s*[×x]\s*(\d+)/i.exec(String(pr.value ?? ''))
  if (!m) return null
  const weight = Number(m[1])
  const reps = Number(m[2])
  if (!(weight > 0) || !(reps > 0)) return null
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}
