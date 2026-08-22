import type { WorkoutLog } from '@/types/workouts'

export interface DailyVolume {
  date: string
  volume: number
}

/** The shape every volume helper needs from a logged set. */
export interface VolumeSet {
  reps: number
  weight_kg: number | null
}

/**
 * Volume (kg lifted) for a single set — the ONE definition used everywhere
 * (progress snapshots, recap, volume trends, muscle balance).
 *
 * `reps × weight_kg` when the set carried external load, otherwise 0. A
 * bodyweight set is deliberately 0 rather than `reps × 1`: "1 kg per rep" is
 * neither honest nor useful, and 3×12 pull-ups showing as "36 kg" in Volume
 * Trends was the bug this helper exists to kill. Counting bodyweight as load
 * (reps × bodyweight × a per-exercise factor) is a future product item.
 */
export function setVolume(set: VolumeSet): number {
  const weight = set.weight_kg ?? 0
  return weight > 0 ? set.reps * weight : 0
}

/** Sum of `setVolume` over a list of sets. */
export function setsVolume(sets: VolumeSet[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0)
}

export function calculateTotalVolume(workouts: WorkoutLog[]): number {
  let total = 0
  for (const w of workouts) {
    for (const ex of w.exercises) {
      total += setsVolume(ex.sets)
    }
  }
  return Math.round(total)
}

export function aggregateVolumeByDay(workouts: WorkoutLog[], period: 7 | 30): DailyVolume[] {
  const buckets: Record<string, number> = {}

  for (const w of workouts) {
    const date = w.workout_date.split('T')[0]
    if (!buckets[date]) buckets[date] = 0
    for (const ex of w.exercises) {
      buckets[date] += setsVolume(ex.sets)
    }
  }

  const result: DailyVolume[] = []
  const now = new Date()
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    result.push({ date: dateStr, volume: Math.round(buckets[dateStr] ?? 0) })
  }

  return result
}

export function aggregateVolumeByWeek(workouts: WorkoutLog[]): DailyVolume[] {
  const now = new Date()
  const weeks: DailyVolume[] = []

  for (let w = 3; w >= 0; w--) {
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() - w * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekStart.getDate() - 6)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    let volume = 0
    for (const workout of workouts) {
      const wDate = workout.workout_date.split('T')[0]
      if (wDate >= weekStartStr && wDate <= weekEndStr) {
        for (const ex of workout.exercises) {
          volume += setsVolume(ex.sets)
        }
      }
    }

    weeks.push({ date: weekEndStr, volume: Math.round(volume) })
  }

  return weeks
}
