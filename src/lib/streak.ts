import { dayKey } from './day'

const DAY_MS = 86_400_000

// /api/steps returns Prisma dates as full ISO timestamps; compare by day key.
const day = (d: string) => d.slice(0, 10)

const dayGap = (later: string, earlier: string) =>
  (Date.parse(`${day(later)}T00:00:00Z`) - Date.parse(`${day(earlier)}T00:00:00Z`)) / DAY_MS

/** Longest run of consecutive calendar days meeting the goal. */
export function longestStepStreak(rows: { date: string; steps: number }[], goal: number): number {
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.steps < goal) run = 0
    else {
      run = prev && dayGap(r.date, prev) === 1 ? run + 1 : 1
      longest = Math.max(longest, run)
    }
    prev = r.steps >= goal ? r.date : null
  }
  return longest
}

/**
 * Consecutive goal-hit days ending today or yesterday. `rows` are one per
 * logged day (`YYYY-MM-DD`); a gap of more than one calendar day ends the
 * streak, and today's still-incomplete row is ignored.
 */
export function currentStepStreak(
  rows: { date: string; steps: number }[],
  goal: number,
  today: string = dayKey(),
): number {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  if (sorted[0] && day(sorted[0].date) === day(today) && sorted[0].steps < goal) sorted.shift()
  let streak = 0
  let prev = today
  for (const r of sorted) {
    if (r.steps < goal) break
    if (dayGap(prev, r.date) > 1) break
    streak++
    prev = r.date
  }
  return streak
}
