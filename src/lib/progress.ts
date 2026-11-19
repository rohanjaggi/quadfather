import { prisma } from '@/lib/prisma'
import { setsVolume } from '@/lib/volume'

interface SetData {
  reps: number
  weight_kg: number | null
}

/** Best set of a session/history by estimated 1RM, and by raw weight. */
interface BestSets {
  /** Highest estimated 1RM found, 0 when no set carried external load. */
  best1RM: number
  /** The set that produced `best1RM`. */
  e1rmSet: SetData | null
  /** Heaviest weight lifted (ties broken by the most reps at that weight). */
  bestWeight: number
  /** Reps of the heaviest set. */
  bestWeightReps: number
}

/**
 * Scan sets for both records we track: the best estimated 1RM (drives
 * `estimated_1rm` / stall detection) and the genuinely heaviest set (drives the
 * "weight PR" the UI shows). They are different sets more often than you'd
 * think — 77.5×10 beats 80×8 on e1RM but is not a weight PR.
 */
export function findBestSets(sets: SetData[], seed?: BestSets): BestSets {
  const out: BestSets = seed
    ? { ...seed }
    : { best1RM: 0, e1rmSet: null, bestWeight: 0, bestWeightReps: 0 }

  for (const s of sets) {
    const weight = s.weight_kg ?? 0
    if (weight <= 0) continue

    const e1rm = calculateEstimated1RM(weight, s.reps)
    if (e1rm > out.best1RM) {
      out.best1RM = e1rm
      out.e1rmSet = s
    }
    if (weight > out.bestWeight || (weight === out.bestWeight && s.reps > out.bestWeightReps)) {
      out.bestWeight = weight
      out.bestWeightReps = s.reps
    }
  }

  return out
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

export function generateSuggestion(
  trainingFocus: string | null,
  currentBestWeight: number,
  currentBestReps: number,
  sessionsSinceImprovement: number,
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

  // strength, or no / unknown focus
  const newWeight = Math.round((currentBestWeight + 2.5) * 10) / 10
  return {
    type: 'increase_weight',
    value: `${newWeight}kg`,
    reason: 'Progress is on track — add 2.5kg',
  }
}

/** One entry of the PR list persisted on the workout row. */
type PrEntry = { exercise: string; type: 'weight' | 'reps'; value: string }

interface Session {
  date: Date
  sets: SetData[]
}

/**
 * Snapshot fields for one exercise from all its sessions (oldest first), plus the PRs
 * each session set. `snapshot` is null when no session carried external load.
 *
 * Records must be strictly better, so the first session to reach one owns it.
 * Bodyweight sessions neither set records nor count as stalls. The first session
 * is not announced as a PR.
 */
export function snapshotFromSessions(sessions: Session[], volumeSince: Date) {
  let best: BestSets = { best1RM: 0, e1rmSet: null, bestWeight: 0, bestWeightReps: 0 }
  let recordDate: Date | null = null
  let weightRecordDate: Date | null = null
  let sinceRecord = 0
  let volume7d = 0
  const prs: (Omit<PrEntry, 'exercise'> | null)[] = []
  const heldAfter: BestSets[] = []

  for (const { date, sets } of sessions) {
    if (date >= volumeSince) volume7d += setsVolume(sets)
    let pr: Omit<PrEntry, 'exercise'> | null = null

    if (sets.some(s => (s.weight_kg ?? 0) > 0)) {
      const before = best
      best = findBestSets(sets, before)
      const weightPr = best.bestWeight > before.bestWeight
      const repsPr = !weightPr && best.bestWeightReps > before.bestWeightReps
      if (weightPr || repsPr) weightRecordDate = date
      if (weightPr || repsPr || best.best1RM > before.best1RM) {
        recordDate = date
        sinceRecord = 0
      } else {
        sinceRecord++
      }
      if (before.bestWeight > 0 && weightPr) {
        pr = { type: 'weight', value: `${best.bestWeight}kg × ${best.bestWeightReps}` }
      } else if (before.bestWeight > 0 && repsPr) {
        pr = { type: 'reps', value: `${best.bestWeightReps} reps @ ${best.bestWeight}kg` }
      }
    }
    prs.push(pr)
    heldAfter.push(best)
  }

  // A backdated session's PR only stands if no later session beat it.
  prs.forEach((pr, i) => {
    if (!pr) return
    const h = heldAfter[i]
    const holds = h.bestWeight === best.bestWeight && (pr.type === 'weight' || h.bestWeightReps === best.bestWeightReps)
    if (!holds) prs[i] = null
  })

  if (!best.e1rmSet) return { snapshot: null, prs }
  return {
    snapshot: {
      estimated_1rm: best.best1RM,
      best_set_weight: best.e1rmSet.weight_kg!,
      best_set_reps: best.e1rmSet.reps,
      best_weight: best.bestWeight,
      best_weight_reps: best.bestWeightReps,
      total_volume_7d: volume7d,
      last_improved_at: recordDate,
      best_weight_improved_at: weightRecordDate,
      sessions_since_improvement: sinceRecord,
    },
    prs,
  }
}

/**
 * Rebuild the user's `ProgressSnapshot` rows for `exerciseNames` from every
 * `ExerciseLog` that exists, after a workout is saved or deleted; snapshots with
 * no loaded sets left are deleted. Returns the PRs workout `prWorkoutId` set, in
 * `exerciseNames` order.
 */
export async function recomputeSnapshotsForExercises(
  userId: number,
  exerciseNames: string[],
  prWorkoutId?: number,
): Promise<PrEntry[]> {
  const names = [...new Set(exerciseNames)].filter(n => n)
  if (names.length === 0) return []

  const logs = await prisma.exerciseLog.findMany({
    where: {
      exercise_name: { in: names },
      workout: { user_id: userId },
    },
    select: {
      exercise_name: true,
      exercise_id: true,
      sets: true,
      workout: { select: { id: true, workout_date: true } },
    },
    // Session order; the workout id ranks same-dated sessions deterministically.
    orderBy: [{ workout: { workout_date: 'asc' } }, { workout_log_id: 'asc' }],
  })

  const byName = new Map<string, typeof logs>()
  for (const name of names) byName.set(name, [])
  for (const log of logs) byName.get(log.exercise_name)?.push(log)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const orphaned: string[] = []
  const prs: PrEntry[] = []

  for (const [exerciseName, rows] of byName) {
    // Every row of one workout is one session of the lift, however many times it was logged.
    const sessions = new Map<number, Session>()
    let exerciseId: number | null = null
    for (const row of rows) {
      const rowSets = Array.isArray(row.sets) ? (row.sets as unknown as SetData[]) : []
      const session = sessions.get(row.workout.id)
      if (session) session.sets.push(...rowSets)
      else sessions.set(row.workout.id, { date: row.workout.workout_date, sets: [...rowSets] })
      if (row.exercise_id != null) exerciseId = row.exercise_id
    }

    const { snapshot, prs: sessionPrs } = snapshotFromSessions([...sessions.values()], sevenDaysAgo)
    if (!snapshot) {
      orphaned.push(exerciseName)
      continue
    }
    const pr = sessionPrs[[...sessions.keys()].findIndex(id => id === prWorkoutId)]
    if (pr) prs.push({ exercise: exerciseName, ...pr })

    const data = { exercise_id: exerciseId, ...snapshot }
    await prisma.progressSnapshot.upsert({
      where: { user_id_exercise_name: { user_id: userId, exercise_name: exerciseName } },
      update: data,
      create: { user_id: userId, exercise_name: exerciseName, ...data },
    })
  }

  if (orphaned.length > 0) {
    await prisma.progressSnapshot.deleteMany({
      where: { user_id: userId, exercise_name: { in: orphaned } },
    })
  }

  return prs
}
