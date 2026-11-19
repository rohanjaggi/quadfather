const DAY_MS = 86_400_000

/**
 * Consecutive goal-hit days ending at the latest row. `rows` are one per
 * logged day (`YYYY-MM-DD`); a gap of more than one calendar day ends the
 * streak, and today's still-incomplete row is ignored.
 */
export function currentStepStreak(
  rows: { date: string; steps: number }[],
  goal: number,
  today: string,
): number {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  if (sorted[0]?.date === today && sorted[0].steps < goal) sorted.shift()
  let streak = 0
  let prev: string | null = null
  for (const r of sorted) {
    if (r.steps < goal) break
    if (prev && (Date.parse(`${prev}T00:00:00Z`) - Date.parse(`${r.date}T00:00:00Z`)) / DAY_MS > 1) break
    streak++
    prev = r.date
  }
  return streak
}
