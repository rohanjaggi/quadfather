/**
 * Shared display formatting helpers (client-safe, no server imports).
 */

/**
 * Format a pace given in seconds-per-km (or minutes-per-km when `unit` is
 * 'min') as `m:ss`. Rounds to the nearest second FIRST so `5:59.6` becomes
 * `6:00`, never `5:60`.
 */
export function formatPace(
  value: number | null | undefined,
  unit: 'sec' | 'min' = 'sec',
): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '–'
  const totalSeconds = Math.round(unit === 'min' ? value * 60 : value)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** `mm:ss` or `h:mm:ss` from a duration in seconds. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '–'
  const t = Math.round(totalSeconds)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`
}

/** Thousands-separated integer (e.g. 12,345). */
export function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString()
}
