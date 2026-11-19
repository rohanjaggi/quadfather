// shortcut: one fixed UTC+8 day for every user; add a per-user timezone column if users outside SGT appear
export const UTC_OFFSET_HOURS = 8

const OFFSET_MS = UTC_OFFSET_HOURS * 3_600_000
const DAY_MS = 86_400_000

/** `YYYY-MM-DD` of the Singapore calendar day containing `date`. */
export function dayKey(date: Date = new Date()): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

/** The Singapore day `key` as UTC instants `[start, end)` — query with `gte start` / `lt end`. */
export function dayRange(key: string = dayKey()): { start: Date; end: Date } {
  const start = Date.parse(`${key}T00:00:00Z`) - OFFSET_MS
  return { start: new Date(start), end: new Date(start + DAY_MS) }
}

/** The day key `n` calendar days after `key` (negative `n` goes back). */
export function addDays(key: string, n: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Start of the Singapore day `n` days before today. */
export function daysAgoStart(n: number): Date {
  return dayRange(addDays(dayKey(), -n)).start
}
