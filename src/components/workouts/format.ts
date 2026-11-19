import { formatInt } from '@/lib/format'
import { setsVolume, type VolumeSet } from '@/lib/volume'
import { addDays, dayKey } from '@/lib/day'
import type { WorkoutLog } from '@/types/workouts'

/** `12,450 kg`. */
export const formatKg = (n: number) => `${formatInt(n)} kg`

/** Weight as typed: up to two decimals, no trailing zeros (62.5, 60, 1.25). */
const kg = (w: number) => String(Math.round(w * 100) / 100)

/** Kilograms lifted in one session (bodyweight sets count 0, see `setVolume`). */
export function sessionVolume(w: Pick<WorkoutLog, 'exercises'>): number {
  return Math.round(w.exercises.reduce((sum, ex) => sum + setsVolume(ex.sets), 0))
}

/** Monday of the Singapore week containing `key` (`getUTCDay` is Sunday-based, hence `+ 6`). */
export function weekStartKey(key: string = dayKey()): string {
  return addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7))
}

/** Formats a `YYYY-MM-DD` key as that calendar date, whatever the device timezone. */
export function formatKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
}

/** "Today", "Yesterday", or "Mon 18 Nov". */
export function relativeDay(key: string): string {
  if (key === dayKey()) return 'Today'
  if (key === addDays(dayKey(), -1)) return 'Yesterday'
  return formatKey(key, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** The heaviest set (more reps breaks a tie); null for an empty list. */
export function topSet<T extends VolumeSet>(sets: T[]): T | null {
  let best: T | null = null
  for (const s of sets) {
    const w = s.weight_kg ?? 0
    const bw = best?.weight_kg ?? 0
    if (!best || w > bw || (w === bw && s.reps > best.reps)) best = s
  }
  return best
}

/** One set as "60 kg × 8", or "12 reps" when it carried no load. */
export function formatSet(s: VolumeSet): string {
  return s.weight_kg ? `${kg(s.weight_kg)} kg × ${s.reps}` : `${s.reps} reps`
}

/**
 * A whole exercise in one line: "3 × 8 · 60 kg" when every set matches,
 * otherwise "4 sets · top 80 kg × 5".
 */
export function setsSummary(sets: VolumeSet[]): string {
  if (sets.length === 0) return 'No sets'
  const first = sets[0]
  const same = sets.every(s => s.reps === first.reps && (s.weight_kg ?? 0) === (first.weight_kg ?? 0))
  if (same) return first.weight_kg ? `${sets.length} × ${first.reps} · ${kg(first.weight_kg)} kg` : `${sets.length} × ${first.reps}`
  const top = topSet(sets)!
  return `${sets.length} sets · top ${formatSet(top)}`
}
