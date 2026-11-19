import { addDays, dayKey } from '@/lib/day'
import { goalState } from '@/components/ui/goal'

export type Period = 7 | 30

/** Plain number in the app's style: grouped thousands, at most `frac` decimals. */
export function num(v: number, frac = 0): string {
  return v.toLocaleString('en-GB', { maximumFractionDigits: frac })
}

/**
 * Splits rows fetched for a doubled window into this period and the one
 * before, using the same "last `period` calendar days including today" rule
 * the API applies, so `current` is exactly what a `?days=period` call returns.
 */
export function splitWindow<T>(rows: T[], keyOf: (r: T) => string, period: number, today = dayKey()) {
  const cutoff = addDays(today, -(period - 1))
  return {
    current: rows.filter(r => keyOf(r) >= cutoff),
    previous: rows.filter(r => keyOf(r) < cutoff),
  }
}

/** Every day key of the period, oldest first, ending today. */
export function periodKeys(period: number, today = dayKey()): string[] {
  return Array.from({ length: period }, (_, i) => addDays(today, i - (period - 1)))
}

/** "↑ 120 kcal vs last week"; null when there is nothing to compare with. */
export function deltaText(curr: number, prev: number | null, fmt: (n: number) => string, period: Period): string | null {
  if (prev === null) return null
  const than = period === 7 ? 'last week' : 'the 30 days before'
  const diff = curr - prev
  // Compare what the reader would see, so 2,140.2 vs 2,140.4 reads "same".
  if (fmt(Math.abs(diff)) === fmt(0)) return `Same as ${than}`
  return `${diff > 0 ? '↑' : '↓'} ${fmt(Math.abs(diff))} vs ${than}`
}

/** "260 kcal under your 2,400 kcal goal", with `over` set when over is bad. */
export function goalText(value: number, goal: number, overIsBad: boolean, fmt: (n: number) => string) {
  if (!(goal > 0)) return null
  const state = goalState(value, goal, overIsBad)
  if (state === 'over') return { text: `${fmt(value - goal)} over your ${fmt(goal)} goal`, over: true }
  if (state === 'under') return { text: `${fmt(goal - value)} under your ${fmt(goal)} goal`, over: false }
  if (!overIsBad && fmt(value - goal) !== fmt(0) && value > goal) {
    return { text: `${fmt(value - goal)} above your ${fmt(goal)} goal`, over: false }
  }
  return { text: `On your ${fmt(goal)} goal`, over: false }
}

/**
 * `YYYY-MM-DD` read and formatted in UTC so the label is the server's day
 * string, never shifted a day by the viewer's timezone.
 */
function utcDay(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Tue 18 Nov" */
export function dayName(iso: string): string {
  const d = utcDay(iso)
  return d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : iso
}

/** Axis label: "Today", a weekday in a 7-day chart, "18 Nov" in a longer one. */
export function axisLabel(iso: string, count: number, today = dayKey()): string {
  if (iso === today) return 'Today'
  const d = utcDay(iso)
  if (!d) return iso
  return count <= 7
    ? d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** 0 = Sunday, as `Date#getUTCDay`. */
export function weekdayOf(iso: string): number | null {
  const d = utcDay(iso)
  return d ? d.getUTCDay() : null
}
