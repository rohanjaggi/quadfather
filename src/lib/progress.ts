import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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
function findBestSets(sets: SetData[], seed?: BestSets): BestSets {
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

/** One entry of the PR list persisted on the workout row. */
type PrEntry = { exercise: string; type: 'weight' | 'reps'; value: string }

/** Attempts of the snapshot read-modify-write before giving up. */
const SNAPSHOT_TX_ATTEMPTS = 3

export async function updateProgressAfterWorkout(
  userId: number,
  workoutId: number,
): Promise<{ prs: PrEntry[] }> {
  const workout = await prisma.workoutLog.findUnique({
    where: { id: workoutId },
    include: { exercises: true },
  })

  if (!workout) return { prs: [] }

  const prs: PrEntry[] = []

  // One workout can legitimately carry two `ExerciseLog` rows with the same
  // `exercise_name` (the form lets you add a lift twice, imports do it too).
  // Iterating rows ran two independent read-modify-writes against the *same*
  // snapshot for one session: `sessions_since_improvement` moved twice, and the
  // second row's back-off branch could un-count the PR the first row had just
  // set. Merge every row's sets per name first, so each distinct exercise is
  // processed exactly once — as one session.
  const merged = new Map<string, { sets: SetData[]; exerciseId: number | null }>()
  for (const exerciseLog of workout.exercises) {
    const rawSets = Array.isArray(exerciseLog.sets)
      ? (exerciseLog.sets as unknown as SetData[])
      : []
    const existing = merged.get(exerciseLog.exercise_name)
    if (existing) {
      existing.sets.push(...rawSets)
      if (existing.exerciseId == null) existing.exerciseId = exerciseLog.exercise_id ?? null
    } else {
      merged.set(exerciseLog.exercise_name, {
        sets: [...rawSets],
        exerciseId: exerciseLog.exercise_id ?? null,
      })
    }
  }

  for (const [exerciseName, { sets: rawSets, exerciseId }] of merged) {
    const session = findBestSets(rawSets)
    if (!session.e1rmSet) continue

    // `const` so the non-null narrowing survives inside the closure below.
    const topSet = session.e1rmSet
    const topWeight = topSet.weight_kg!
    const best1RM = session.best1RM
    const sessionBestWeight = session.bestWeight
    const sessionBestWeightReps = session.bestWeightReps

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
      return sum + setsVolume(log.sets as unknown as SetData[])
    }, 0)

    // Read-modify-write of the snapshot row. Two workout POSTs for the same
    // user+exercise really can land at once (client retry, Strava sync racing a
    // manual log): unguarded, both read the pre-PR snapshot and the second
    // write erases the first one's record. Serializable + a bounded retry is
    // the portable way to make it atomic through Prisma (no `SELECT … FOR
    // UPDATE` available). The PR is *returned* rather than pushed so a retried
    // attempt can never announce the same PR twice.
    const applyOnce = async (): Promise<PrEntry | null> =>
      prisma.$transaction(
        async tx => {
          const snapshot = await tx.progressSnapshot.findUnique({
            where: {
              user_id_exercise_name: { user_id: userId, exercise_name: exerciseName },
            },
          })

          if (!snapshot) {
            await tx.progressSnapshot.create({
              data: {
                user_id: userId,
                exercise_name: exerciseName,
                exercise_id: exerciseId,
                estimated_1rm: best1RM,
                best_set_weight: topWeight,
                best_set_reps: topSet.reps,
                best_weight: sessionBestWeight,
                best_weight_reps: sessionBestWeightReps,
                total_volume_7d: volume7d,
                last_improved_at: workout.workout_date,
                // First recorded session — its heaviest set *is* the weight
                // record, so it dates the weight PR too.
                best_weight_improved_at: workout.workout_date,
                sessions_since_improvement: 0,
              },
            })
            return null
          }

          // The stored e1RM fields still move only on an e1RM improvement —
          // it's the load-agnostic measure of "did this session move the
          // needle".
          const improved = best1RM > snapshot.estimated_1rm

          // PRs are judged against the *weight* record, independently of e1RM,
          // so the list can never announce a lighter weight than the one it
          // replaced.
          const weightPr = sessionBestWeight > snapshot.best_weight
          const repsPr =
            !weightPr &&
            sessionBestWeight === snapshot.best_weight &&
            sessionBestWeightReps > snapshot.best_weight_reps

          // Any of the three is a record being set. Dating only e1RM PRs left a
          // genuine weight/reps PR carrying a stale `last_improved_at` — so it
          // dropped out of the 7-day PR list built from that column, and the
          // session was miscounted as another step towards a deload.
          const recordSet = improved || weightPr || repsPr

          await tx.progressSnapshot.update({
            where: { id: snapshot.id },
            data: {
              estimated_1rm: improved ? best1RM : snapshot.estimated_1rm,
              best_set_weight: improved ? topWeight : snapshot.best_set_weight,
              best_set_reps: improved ? topSet.reps : snapshot.best_set_reps,
              best_weight: weightPr ? sessionBestWeight : snapshot.best_weight,
              best_weight_reps:
                weightPr || repsPr ? sessionBestWeightReps : snapshot.best_weight_reps,
              total_volume_7d: volume7d,
              // The date of the *session*, not of the write — so a backdated log
              // dates its record correctly, and `recomputeSnapshotsForExercises`
              // (which can only know workout dates) produces the same value.
              last_improved_at: recordSet ? workout.workout_date : snapshot.last_improved_at,
              // Separate clock for the *weight* record. `last_improved_at` moves
              // on an e1RM improvement too, so using it to date the PR list made
              // a 90×12 session (better e1RM, lighter bar) claim the standing
              // "102.5kg" weight PR happened that day. Only a weight/reps PR
              // moves this one, and only this one dates the PR list.
              best_weight_improved_at:
                weightPr || repsPr ? workout.workout_date : snapshot.best_weight_improved_at,
              sessions_since_improvement: recordSet
                ? 0
                : snapshot.sessions_since_improvement + 1,
              exercise_id: exerciseId ?? snapshot.exercise_id,
            },
          })

          if (weightPr) {
            return {
              exercise: exerciseName,
              type: 'weight',
              value: `${sessionBestWeight}kg × ${sessionBestWeightReps}`,
            }
          }
          if (repsPr) {
            return {
              exercise: exerciseName,
              type: 'reps',
              value: `${sessionBestWeightReps} reps @ ${sessionBestWeight}kg`,
            }
          }
          return null
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

    let pr: PrEntry | null = null
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          pr = await applyOnce()
          break
        } catch (err) {
          // P2002 — a concurrent POST won the race on @@unique([user_id,
          // exercise_name]) between the findUnique and the create; re-running
          // re-reads and takes the update path instead of losing this session.
          // P2034 — serialization failure / deadlock, the expected outcome when
          // two transactions touch the same snapshot row.
          const retryable =
            err instanceof Prisma.PrismaClientKnownRequestError &&
            (err.code === 'P2002' || err.code === 'P2034')
          if (!retryable || attempt >= SNAPSHOT_TX_ATTEMPTS) throw err
        }
      }
    } catch (err) {
      // One exercise exhausting its retries used to escape the loop, so the
      // whole workout lost the PRs already collected *and* every exercise after
      // it was skipped. Snapshots are per-exercise rows: drop the one that
      // failed, keep the rest.
      console.error(`Progress update failed for exercise "${exerciseName}":`, err)
      continue
    }
    if (pr) prs.push(pr)
  }

  return { prs }
}

/**
 * Rebuild the user's `ProgressSnapshot` rows for `exerciseNames` from the
 * `ExerciseLog` rows that still exist.
 *
 * Called after a workout is deleted: the incremental path above only ever moves
 * records *up*, so deleting the session that set a record used to leave the PR
 * standing in the snapshot forever (and the old code only cleaned up when the
 * exercise had zero logs left).
 *
 * Everything is derived, nothing is preserved:
 *  - `estimated_1rm` / `best_set_weight` / `best_set_reps` — best-e1RM set of
 *    all remaining sets.
 *  - `best_weight` / `best_weight_reps` — heaviest remaining set.
 *  - `total_volume_7d` — remaining sets in the last 7 days.
 *  - `last_improved_at` — the workout date of the *earliest* session that set
 *    any of the tracked records (best e1RM, heaviest weight, or most reps at
 *    that weight — the same three the incremental path treats as a record), not
 *    "now"; `best_weight_improved_at` — the same, but for the heaviest-set
 *    record alone (what the PR list dates itself from); and
 *    `sessions_since_improvement` — how many *weighted* sessions of
 *    that exercise have been logged since. Bodyweight-only sessions are skipped
 *    in both counts because the incremental path skips them too, so a deletion
 *    can't silently pull a stalled lift out of deload territory (or push it in).
 *  - snapshot deleted when no rows (or no loaded sets) remain.
 *
 * Runs two queries total regardless of how many exercises are passed.
 */
export async function recomputeSnapshotsForExercises(
  userId: number,
  exerciseNames: string[],
): Promise<void> {
  const names = [...new Set(exerciseNames)].filter(n => n)
  if (names.length === 0) return

  const logs = await prisma.exerciseLog.findMany({
    where: {
      exercise_name: { in: names },
      workout: { user_id: userId },
    },
    select: {
      exercise_name: true,
      exercise_id: true,
      sets: true,
      // The workout id is what makes "two rows, one session" knowable here —
      // without it, a workout that logged the same lift twice was scanned as
      // two sessions and disagreed with the incremental path's counter.
      workout: { select: { id: true, workout_date: true } },
    },
    // Deterministic session order: same-dated workouts (both stored at
    // midnight, the common case for backdated logs) otherwise came back in
    // whatever order Postgres felt like, so which session "owned" a record —
    // and therefore `last_improved_at` — could flip between runs.
    orderBy: [{ workout: { workout_date: 'asc' } }, { workout_log_id: 'asc' }],
  })

  const byName = new Map<string, typeof logs>()
  for (const name of names) byName.set(name, [])
  for (const log of logs) byName.get(log.exercise_name)?.push(log)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const orphaned: string[] = []

  for (const [exerciseName, rows] of byName) {
    if (rows.length === 0) {
      orphaned.push(exerciseName)
      continue
    }

    // Collapse rows to sessions: every `ExerciseLog` row of the same workout is
    // one session of that exercise, however many times it was logged.
    const byWorkout = new Map<
      number,
      { id: number; date: Date; sets: SetData[]; exerciseId: number | null }
    >()
    for (const row of rows) {
      const rowSets = Array.isArray(row.sets) ? (row.sets as unknown as SetData[]) : []
      const existing = byWorkout.get(row.workout.id)
      if (existing) {
        existing.sets.push(...rowSets)
        if (row.exercise_id != null) existing.exerciseId = row.exercise_id
      } else {
        byWorkout.set(row.workout.id, {
          id: row.workout.id,
          date: row.workout.workout_date,
          sets: [...rowSets],
          exerciseId: row.exercise_id,
        })
      }
    }

    // Oldest first so index order == session order; the workout id breaks ties
    // so same-dated sessions rank the same way the query ordered them.
    const sessions = [...byWorkout.values()].sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id,
    )

    let best: BestSets = { best1RM: 0, e1rmSet: null, bestWeight: 0, bestWeightReps: 0 }
    // Counted over *weighted* sessions only: the incremental path bails out of a
    // bodyweight-only session before it touches `sessions_since_improvement`, so
    // counting them here would make the two paths disagree after a deletion.
    let weightedSessions = 0
    let recordOrdinal = -1
    let recordDate: Date | null = null
    // Separate clock for the weight/reps record only — the column the PR list
    // dates itself from. See `best_weight_improved_at` in the incremental path.
    let weightRecordDate: Date | null = null
    let volume7d = 0
    let exerciseId: number | null = null

    for (let i = 0; i < sessions.length; i++) {
      const sets = sessions[i].sets
      if (sessions[i].date >= sevenDaysAgo) volume7d += setsVolume(sets)
      if (sessions[i].exerciseId != null) exerciseId = sessions[i].exerciseId

      if (!sets.some(s => (s.weight_kg ?? 0) > 0)) continue
      weightedSessions++

      const before1RM = best.best1RM
      const beforeWeight = best.bestWeight
      const beforeWeightReps = best.bestWeightReps
      best = findBestSets(sets, best)
      // Strictly greater, so the *first* session at a given record owns it. All
      // three records count, matching `recordSet` in the incremental path — a
      // weight or reps PR dates the snapshot just like an e1RM PR does.
      const weightRecord =
        best.bestWeight > beforeWeight ||
        (best.bestWeight === beforeWeight && best.bestWeightReps > beforeWeightReps)
      if (best.best1RM > before1RM || weightRecord) {
        recordOrdinal = weightedSessions - 1
        recordDate = sessions[i].date
      }
      if (weightRecord) weightRecordDate = sessions[i].date
    }

    if (!best.e1rmSet || !recordDate) {
      // Only bodyweight sets left — there is no 1RM to snapshot.
      orphaned.push(exerciseName)
      continue
    }

    const topWeight = best.e1rmSet.weight_kg!
    const data = {
      exercise_id: exerciseId,
      estimated_1rm: best.best1RM,
      best_set_weight: topWeight,
      best_set_reps: best.e1rmSet.reps,
      best_weight: best.bestWeight,
      best_weight_reps: best.bestWeightReps,
      total_volume_7d: volume7d,
      last_improved_at: recordDate,
      best_weight_improved_at: weightRecordDate,
      sessions_since_improvement: weightedSessions - 1 - recordOrdinal,
    }

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
}
