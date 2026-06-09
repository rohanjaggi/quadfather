import { muscleToZones, type MuscleZone } from './muscle-zones'
import { EXERCISE_MUSCLES } from './exercise-muscles'

interface ExerciseInput {
  exercise_name: string
  sets: { reps: number; weight_kg: number | null }[]
}

export function calculateMuscleIntensities(
  exercises: ExerciseInput[]
): Record<MuscleZone, number> {
  const rawScores: Partial<Record<MuscleZone, number>> = {}

  for (const exercise of exercises) {
    const key = exercise.exercise_name.toLowerCase()
    const muscleData = EXERCISE_MUSCLES[key]
    if (!muscleData) continue

    const setCount = exercise.sets.length

    for (const muscle of muscleData.primary) {
      const zones = muscleToZones(muscle)
      for (const zone of zones) {
        rawScores[zone] = (rawScores[zone] ?? 0) + setCount * 1.0
      }
    }

    for (const muscle of muscleData.secondary) {
      const zones = muscleToZones(muscle)
      for (const zone of zones) {
        rawScores[zone] = (rawScores[zone] ?? 0) + setCount * 0.5
      }
    }
  }

  const maxScore = Math.max(...Object.values(rawScores), 0)
  const normalized: Record<string, number> = {}

  if (maxScore > 0) {
    for (const [zone, score] of Object.entries(rawScores)) {
      normalized[zone] = score / maxScore
    }
  }

  return normalized as Record<MuscleZone, number>
}

export function intensitiesFromMuscleNames(
  muscleNames: string[]
): Record<MuscleZone, number> {
  const result: Partial<Record<MuscleZone, number>> = {}
  for (const name of muscleNames) {
    const zones = muscleToZones(name)
    for (const zone of zones) {
      result[zone] = 0.6
    }
  }
  return result as Record<MuscleZone, number>
}
