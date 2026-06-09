import type { WorkoutLog } from '@/types/workouts'

export interface DailyVolume {
  date: string
  volume: number
}

export function calculateTotalVolume(workouts: WorkoutLog[]): number {
  let total = 0
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        total += set.reps * (set.weight_kg ?? 1)
      }
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
      for (const set of ex.sets) {
        buckets[date] += set.reps * (set.weight_kg ?? 1)
      }
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
          for (const set of ex.sets) {
            volume += set.reps * (set.weight_kg ?? 1)
          }
        }
      }
    }

    weeks.push({ date: weekEndStr, volume: Math.round(volume) })
  }

  return weeks
}
