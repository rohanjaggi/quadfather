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

/**
 * The PR `type` is server-controlled and is gaining new kinds (e1RM), so treat
 * it as an opaque string and fall back to a bare "PR" when it's missing.
 */
export function prTypeLabel(pr: WorkoutPR): string {
  const type: unknown = pr.type
  return typeof type === 'string' && type.trim() ? `${type} PR` : 'PR'
}

/** PR values are pre-formatted text (e.g. `100kg × 5`); render them as-is. */
export function prDisplayValue(pr: WorkoutPR): string {
  const value: unknown = pr.value
  return value == null ? '—' : String(value)
}
