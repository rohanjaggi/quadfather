import { prisma } from '@/lib/prisma'

interface SetData {
  reps: number
  weight_kg: number | null
}

export interface ProgressSuggestion {
  type: 'increase_weight' | 'increase_reps' | 'increase_sets' | 'deload' | 'maintain'
  value: string
  reason: string
}

export function calculateEstimated1RM(weight: number, reps: number): number {
  const raw = weight * (1 + reps / 30)
  return Math.round(raw * 10) / 10
}

export function calculateSetVolume(sets: SetData[]): number {
  return sets.reduce((sum, s) => sum + s.reps * (s.weight_kg ?? 0), 0)
}

export function generateSuggestion(
  trainingFocus: string | null,
  currentBestWeight: number,
  currentBestReps: number,
  sessionsSinceImprovement: number,
  _lastSets: SetData[],
): ProgressSuggestion {
  const isStrength = trainingFocus === 'strength'
  const isHypertrophy = trainingFocus === 'hypertrophy'

  if (sessionsSinceImprovement >= 6) {
    const deloadWeight = Math.round(currentBestWeight * 0.85 * 10) / 10
    return {
      type: 'deload',
      value: `${deloadWeight}kg`,
      reason: `Stalled for ${sessionsSinceImprovement} sessions — take a deload week at ${deloadWeight}kg`,
    }
  }

  if (sessionsSinceImprovement >= 3) {
    if (isStrength) {
      return {
        type: 'increase_reps',
        value: `${currentBestReps + 1} reps`,
        reason: `Stalled for ${sessionsSinceImprovement} sessions — add 1 rep to build strength endurance`,
      }
    } else {
      return {
        type: 'increase_sets',
        value: '+1 set',
        reason: `Stalled for ${sessionsSinceImprovement} sessions — add a set to increase volume`,
      }
    }
  }

  if (isStrength) {
    const newWeight = Math.round((currentBestWeight + 2.5) * 10) / 10
    return {
      type: 'increase_weight',
      value: `${newWeight}kg`,
      reason: 'Progress is on track — add 2.5kg',
    }
  }

  if (isHypertrophy) {
    if (currentBestReps < 12) {
      return {
        type: 'increase_reps',
        value: `${currentBestReps + 1} reps`,
        reason: 'Build up reps to 12 before increasing weight',
      }
    } else {
      const newWeight = Math.round((currentBestWeight + 2.5) * 10) / 10
      return {
        type: 'increase_weight',
        value: `${newWeight}kg × 8 reps`,
        reason: 'Hit 12 reps — increase weight and reset to 8 reps',
      }
    }
  }

  // default (null / unknown focus) — same as strength
  const newWeight = Math.round((currentBestWeight + 2.5) * 10) / 10
  return {
    type: 'increase_weight',
    value: `${newWeight}kg`,
    reason: 'Progress is on track — add 2.5kg',
  }
}

export async function updateProgressAfterWorkout(
  userId: number,
  workoutId: number,
): Promise<{ prs: { exercise: string; type: 'weight' | 'reps'; value: string }[] }> {
  const workout = await prisma.workoutLog.findUnique({
    where: { id: workoutId },
    include: { exercises: true },
  })

  if (!workout) return { prs: [] }

  const prs: { exercise: string; type: 'weight' | 'reps'; value: string }[] = []

  for (const exerciseLog of workout.exercises) {
    const rawSets = exerciseLog.sets as unknown as SetData[]
    const weightedSets = rawSets.filter(s => (s.weight_kg ?? 0) > 0)
    if (weightedSets.length === 0) continue

    // Find the set with best estimated 1RM
    let bestSet: SetData | null = null
    let best1RM = 0
    for (const s of weightedSets) {
      const e1rm = calculateEstimated1RM(s.weight_kg!, s.reps)
      if (e1rm > best1RM) {
        best1RM = e1rm
        bestSet = s
      }
    }
    if (!bestSet) continue

    const exerciseName = exerciseLog.exercise_name

    // 7-day rolling volume
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentLogs = await prisma.exerciseLog.findMany({
      where: {
        exercise_name: exerciseName,
        workout: {
          user_id: userId,
          workout_date: { gte: sevenDaysAgo },
        },
      },
    })

    const volume7d = recentLogs.reduce((sum, log) => {
      return sum + calculateSetVolume(log.sets as unknown as SetData[])
    }, 0)

    const existing = await prisma.progressSnapshot.findUnique({
      where: {
        user_id_exercise_name: {
          user_id: userId,
          exercise_name: exerciseName,
        },
      },
    })

    if (existing) {
      const improved = best1RM > existing.estimated_1rm

      if (improved) {
        // Weight PR: best set weight increased
        if (bestSet.weight_kg! > existing.best_set_weight) {
          prs.push({
            exercise: exerciseName,
            type: 'weight',
            value: `${bestSet.weight_kg}kg`,
          })
        }
        // Reps PR: same weight, more reps
        if (
          bestSet.weight_kg === existing.best_set_weight &&
          bestSet.reps > existing.best_set_reps
        ) {
          prs.push({
            exercise: exerciseName,
            type: 'reps',
            value: `${bestSet.reps} reps @ ${bestSet.weight_kg}kg`,
          })
        }
      }

      await prisma.progressSnapshot.update({
        where: { id: existing.id },
        data: {
          estimated_1rm: improved ? best1RM : existing.estimated_1rm,
          best_set_weight: improved ? bestSet.weight_kg! : existing.best_set_weight,
          best_set_reps: improved ? bestSet.reps : existing.best_set_reps,
          total_volume_7d: volume7d,
          last_improved_at: improved ? new Date() : existing.last_improved_at,
          sessions_since_improvement: improved ? 0 : existing.sessions_since_improvement + 1,
          exercise_id: exerciseLog.exercise_id ?? existing.exercise_id,
        },
      })
    } else {
      await prisma.progressSnapshot.create({
        data: {
          user_id: userId,
          exercise_name: exerciseName,
          exercise_id: exerciseLog.exercise_id ?? null,
          estimated_1rm: best1RM,
          best_set_weight: bestSet.weight_kg!,
          best_set_reps: bestSet.reps,
          total_volume_7d: volume7d,
          last_improved_at: new Date(),
          sessions_since_improvement: 0,
        },
      })
    }
  }

  return { prs }
}

export async function getExerciseProgress(
  userId: number,
  exerciseName: string,
  trainingFocus: string | null,
): Promise<import('@/types/exercises').ProgressData> {
  const snapshot = await prisma.progressSnapshot.findUnique({
    where: {
      user_id_exercise_name: {
        user_id: userId,
        exercise_name: exerciseName,
      },
    },
  })

  // Most recent ExerciseLog for this user + exercise
  const latestLog = await prisma.exerciseLog.findFirst({
    where: {
      exercise_name: exerciseName,
      workout: { user_id: userId },
    },
    orderBy: { workout: { workout_date: 'desc' } },
    include: { workout: true },
  })

  if (!snapshot || !latestLog) {
    return {
      last_session: null,
      suggestion: null,
      status: 'new',
      stall_weeks: 0,
      is_pr_territory: false,
    }
  }

  const lastSets = latestLog.sets as unknown as SetData[]
  const stallWeeks = Math.floor(snapshot.sessions_since_improvement / 1) // 1 session ≈ 1 week approximation
  const isStalled = snapshot.sessions_since_improvement >= 3

  const suggestion = generateSuggestion(
    trainingFocus,
    snapshot.best_set_weight,
    snapshot.best_set_reps,
    snapshot.sessions_since_improvement,
    lastSets,
  )

  // Current max estimated 1RM from last session
  let currentMax1RM = 0
  for (const s of lastSets) {
    if ((s.weight_kg ?? 0) > 0) {
      const e1rm = calculateEstimated1RM(s.weight_kg!, s.reps)
      if (e1rm > currentMax1RM) currentMax1RM = e1rm
    }
  }
  const isPrTerritory = currentMax1RM >= snapshot.estimated_1rm * 0.95

  return {
    last_session: {
      date: latestLog.workout.workout_date.toISOString(),
      sets: lastSets,
    },
    suggestion,
    status: isStalled ? 'stalled' : 'progressing',
    stall_weeks: stallWeeks,
    is_pr_territory: isPrTerritory,
  }
}
