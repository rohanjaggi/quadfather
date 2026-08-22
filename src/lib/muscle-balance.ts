import type { WorkoutLog } from '@/types/workouts'
import { EXERCISE_MUSCLES } from './exercise-muscles'
import { muscleToZone, type MuscleZone } from './muscle-zones'
import { setsVolume } from './volume'

export interface BalanceRatio {
  label: string
  left: { name: string; value: number }
  right: { name: string; value: number }
  leftPct: number
  rightPct: number
  status: 'balanced' | 'skewed' | 'imbalanced'
}

const PUSH_ZONES: MuscleZone[] = ['chest', 'front_delts', 'triceps']
const PULL_ZONES: MuscleZone[] = ['upper_back', 'lats', 'rear_delts', 'biceps']

const UPPER_ZONES: MuscleZone[] = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms', 'upper_back', 'lats',
]
const LOWER_ZONES: MuscleZone[] = ['quads', 'quads_inner', 'hamstrings', 'glutes', 'calves', 'hip_flexors']

const ANTERIOR_ZONES: MuscleZone[] = ['chest', 'quads', 'quads_inner', 'front_delts', 'abs', 'hip_flexors']
const POSTERIOR_ZONES: MuscleZone[] = ['upper_back', 'lats', 'lower_back', 'rear_delts', 'hamstrings', 'glutes', 'calves']

function getStatus(pct: number): 'balanced' | 'skewed' | 'imbalanced' {
  if (pct >= 40 && pct <= 60) return 'balanced'
  if (pct >= 30 && pct <= 70) return 'skewed'
  return 'imbalanced'
}

export function calculateMuscleBalance(workouts: WorkoutLog[]): BalanceRatio[] {
  const zoneVolume: Partial<Record<MuscleZone, number>> = {}

  for (const w of workouts) {
    for (const ex of w.exercises) {
      const key = ex.exercise_name.toLowerCase()
      const data = EXERCISE_MUSCLES[key]
      if (!data) continue

      const setVol = setsVolume(ex.sets)

      for (const muscle of data.primary) {
        const zone = muscleToZone(muscle)
        if (zone) {
          zoneVolume[zone] = (zoneVolume[zone] ?? 0) + setVol
        }
      }
    }
  }

  function sumZones(zones: MuscleZone[]): number {
    return zones.reduce((s, z) => s + (zoneVolume[z] ?? 0), 0)
  }

  function buildRatio(label: string, leftName: string, leftZones: MuscleZone[], rightName: string, rightZones: MuscleZone[]): BalanceRatio {
    const leftVal = sumZones(leftZones)
    const rightVal = sumZones(rightZones)
    const total = leftVal + rightVal
    const leftPct = total > 0 ? Math.round((leftVal / total) * 100) : 50
    const rightPct = total > 0 ? 100 - leftPct : 50

    return {
      label,
      left: { name: leftName, value: leftVal },
      right: { name: rightName, value: rightVal },
      leftPct,
      rightPct,
      status: getStatus(leftPct),
    }
  }

  return [
    buildRatio('Push : Pull', 'Push', PUSH_ZONES, 'Pull', PULL_ZONES),
    buildRatio('Upper : Lower', 'Upper', UPPER_ZONES, 'Lower', LOWER_ZONES),
    buildRatio('Anterior : Posterior', 'Anterior', ANTERIOR_ZONES, 'Posterior', POSTERIOR_ZONES),
  ]
}
