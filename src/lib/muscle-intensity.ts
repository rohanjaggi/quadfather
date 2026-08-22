import { muscleToZones, type MuscleZone } from './muscle-zones'

/**
 * `exercise-muscles.ts` is ~100 KB of static data. It is deliberately NOT
 * imported statically here: every client page that shows a muscle map would
 * otherwise ship it in its first-load bundle. It is pulled in on demand and
 * memoised for the rest of the session.
 */
type ExerciseMuscleMap = Record<string, { primary: string[]; secondary: string[] }>

let muscleMapPromise: Promise<ExerciseMuscleMap> | null = null

export function loadExerciseMuscles(): Promise<ExerciseMuscleMap> {
  if (!muscleMapPromise) {
    // A rejected promise must not be memoised: a single flaky chunk request
    // would otherwise leave every muscle map on the page permanently empty for
    // the rest of the session. Clear the cache so the next caller retries.
    muscleMapPromise = import('./exercise-muscles')
      .then(m => m.EXERCISE_MUSCLES)
      .catch(err => {
        muscleMapPromise = null
        throw err
      })
  }
  return muscleMapPromise
}

interface ExerciseInput {
  exercise_name: string
  sets: { reps: number; weight_kg: number | null }[]
}

function intensitiesFrom(
  muscleMap: ExerciseMuscleMap,
  exercises: ExerciseInput[],
): Record<MuscleZone, number> {
  const rawScores: Partial<Record<MuscleZone, number>> = {}

  for (const exercise of exercises) {
    const key = exercise.exercise_name.toLowerCase()
    const muscleData = muscleMap[key]
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

/**
 * Per-zone intensity in 0..1, normalised against the hardest-hit zone.
 * Async because the exercise→muscle table is code-split (see above).
 */
export async function calculateMuscleIntensities(
  exercises: ExerciseInput[],
): Promise<Record<MuscleZone, number>> {
  if (exercises.length === 0) return {} as Record<MuscleZone, number>
  const muscleMap = await loadExerciseMuscles()
  return intensitiesFrom(muscleMap, exercises)
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
