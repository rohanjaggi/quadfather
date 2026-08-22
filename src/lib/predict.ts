import { prisma } from '@/lib/prisma'
import { calculateEstimated1RM, type ProgressSuggestion } from '@/lib/progress'
import { coerceNumber, fillTemplate, parseJsonObject } from '@/lib/ai'

interface SetData {
  reps: number
  weight_kg: number | null
}

export interface PredictionResult {
  /** `weight_kg` is null for a bodyweight set — the model is allowed to say so. */
  sets: { reps: number; weight_kg: number | null }[]
  reasoning: string
}

const PREDICT_PROMPT = `You are a strength coach predicting the next training session for one exercise.

Exercise: {exercise_name}
User's goal: {fitness_goal}
Training focus: {training_focus}
Body weight: {weight_kg}kg

Recent history (most recent first):
{history}

Current stats:
- Estimated 1RM: {estimated_1rm}kg
- Best set by estimated 1RM: {best_set_weight}kg × {best_set_reps}
- Heaviest set: {best_weight}kg × {best_weight_reps}
- Sessions since improvement: {sessions_since_improvement}
- 7-day volume: {total_volume_7d}kg

Predict the EXACT sets, reps, and weight for the next session.
Consider:
- Progressive overload appropriate to the goal
- Fatigue accumulation (volume trends, session frequency)
- Stall patterns (when to back off vs push through)
- Rep ranges appropriate to the training focus (strength: 3-6, hypertrophy: 8-12, default: 6-10)

Return ONLY valid JSON:
{
  "sets": [{"reps": <number>, "weight_kg": <number>}],
  "reasoning": "<one sentence explaining your prediction>"
}`

export function formatHistory(
  logs: { workout_date: Date; sets: SetData[] }[],
): string {
  return logs
    .map(log => {
      const weightedSets = log.sets.filter(s => (s.weight_kg ?? 0) > 0)
      if (weightedSets.length === 0) return null

      const reps = weightedSets[0].reps
      const weight = weightedSets[0].weight_kg!
      const allSame = weightedSets.every(s => s.reps === reps && s.weight_kg === weight)

      let setsStr: string
      if (allSame) {
        setsStr = `${weightedSets.length}×${reps} @ ${weight}kg`
      } else {
        setsStr = weightedSets.map(s => `${s.reps}@${s.weight_kg}kg`).join(', ')
      }

      const best1RM = Math.max(...weightedSets.map(s => calculateEstimated1RM(s.weight_kg!, s.reps)))
      const dateStr = log.workout_date.toISOString().split('T')[0]
      return `${dateStr}: ${setsStr} (est 1RM: ${best1RM}kg)`
    })
    .filter(Boolean)
    .join('\n')
}

export function buildPredictPrompt(params: {
  exerciseName: string
  fitnessGoal: string | null
  trainingFocus: string | null
  weightKg: number | null
  history: string
  estimated1rm: number
  bestSetWeight: number
  bestSetReps: number
  /** Heaviest set ever logged — see `best_weight` on `ProgressSnapshot`. */
  bestWeight: number
  bestWeightReps: number
  sessionsSinceImprovement: number
  totalVolume7d: number
}): string {
  // `fillTemplate` (not chained `String.replace`): the exercise name and the
  // history block are user-controlled text, and `replace` interprets `$&`, `$'`
  // and `$1` in the *replacement*, so an exercise called `$'` used to splice a
  // copy of the rest of the prompt into the prompt. It also substitutes in one
  // pass, so an injected value can never be treated as a placeholder itself.
  return fillTemplate(PREDICT_PROMPT, {
    exercise_name: params.exerciseName,
    fitness_goal: params.fitnessGoal || 'general fitness',
    training_focus: params.trainingFocus || 'balanced',
    weight_kg: String(params.weightKg ?? 'unknown'),
    history: params.history || 'No previous sessions recorded.',
    estimated_1rm: String(params.estimated1rm),
    best_set_weight: String(params.bestSetWeight),
    best_set_reps: String(params.bestSetReps),
    // The AI path used to see only the best-*e1RM* set, which can be lighter
    // than a weight the user has already lifted (77.5×10 beats 80×8 on e1RM) —
    // the exact defect the deterministic fallback anchors on `best_weight` to
    // avoid. Give the model both.
    best_weight: String(params.bestWeight),
    best_weight_reps: String(params.bestWeightReps),
    sessions_since_improvement: String(params.sessionsSinceImprovement),
    total_volume_7d: String(params.totalVolume7d),
  })
}

/**
 * Parse the model's prediction, or throw.
 *
 * Throwing is the point: the caller (`/api/workouts/predict`) catches and falls
 * back to the deterministic `generateSuggestion` path, which is strictly better
 * than what this used to do — `Math.round(Number("8-10"))` is `NaN`, which
 * serialises to `null` and reached the client as a set with no reps.
 *
 * The value ranges below mirror `POST /api/workouts`'s own validation, so a
 * prediction can never suggest a set the user could not have logged. Without
 * them a plausible-looking-but-wrong reply rendered as "0 reps × 1200kg";
 * throwing sends it to the deterministic fallback instead.
 */
export function parsePredictionResponse(raw: string): PredictionResult {
  // Shared with lib/ai: strips code fences and ignores any prose preamble.
  const data = parseJsonObject(raw)

  if (!Array.isArray(data.sets) || data.sets.length === 0) {
    throw new Error('AI prediction missing sets array')
  }

  // Same ceiling the deterministic path honours, applied before the per-set
  // work so a runaway reply can't be rendered as 200 sets.
  const sets = data.sets.slice(0, MAX_SETS).map((entry: unknown, index: number) => {
    const set = typeof entry === 'object' && entry !== null
      ? (entry as Record<string, unknown>)
      : null
    const reps = set ? coerceNumber(set.reps) : null
    // A bodyweight set genuinely has no load, and `weight_kg: null` is the
    // right answer for one. Rejecting it meant every prediction for such an
    // exercise threw — and because only the success path caches, the route
    // re-paid for the AI call on every keystroke, forever.
    const rawWeight = set ? set.weight_kg : null
    const weight = rawWeight == null ? null : coerceNumber(rawWeight)

    if (reps === null || !Number.isFinite(reps)) {
      throw new Error(`AI prediction set ${index + 1} has non-numeric reps`)
    }
    // Null is valid; *garbage* is not — "heavy" must not silently become
    // "bodyweight".
    if (rawWeight != null && (weight === null || !Number.isFinite(weight))) {
      throw new Error(`AI prediction set ${index + 1} has non-numeric weight`)
    }
    if (reps < 1 || reps > 1000) {
      throw new Error(`AI prediction set ${index + 1} has out-of-range reps`)
    }
    if (weight != null && (weight < 0 || weight > 1000)) {
      throw new Error(`AI prediction set ${index + 1} has out-of-range weight`)
    }

    return {
      reps: Math.round(reps),
      weight_kg: weight == null ? null : Math.round(weight * 10) / 10,
    }
  })

  return {
    sets,
    reasoning: String(data.reasoning ?? ''),
  }
}

export async function fetchExerciseHistory(
  userId: number,
  exerciseName: string,
  limit: number = 8,
): Promise<{ workout_date: Date; sets: SetData[] }[]> {
  const logs = await prisma.exerciseLog.findMany({
    where: {
      exercise_name: exerciseName,
      workout: { user_id: userId },
    },
    orderBy: { workout: { workout_date: 'desc' } },
    take: limit,
    include: { workout: { select: { workout_date: true } } },
  })

  return logs.map(log => ({
    workout_date: log.workout.workout_date,
    sets: log.sets as unknown as SetData[],
  }))
}

/** Never hand back more working sets than this, whatever the suggestion says. */
const MAX_SETS = 10
/** Rep count at which `generateSuggestion`'s hypertrophy rule bumps the weight… */
const HYPERTROPHY_REP_CEILING = 12
/** …and resets the rep target back down to this. */
const HYPERTROPHY_REP_RESET = 8

/**
 * Turn a deterministic `ProgressSuggestion` into concrete sets.
 *
 * Used for the fallback prediction when the AI call fails: previously the sets
 * were the user's *previous* best set while the reasoning underneath said "add
 * 2.5kg", so the two contradicted each other. Deriving both from the same
 * suggestion keeps them in agreement.
 */
export function suggestionToSets(
  suggestion: ProgressSuggestion,
  bestWeight: number,
  bestReps: number,
  lastSetCount: number,
  trainingFocus: string | null = null,
): { reps: number; weight_kg: number }[] {
  const sets = Math.max(1, Math.min(lastSetCount || 3, MAX_SETS))
  const round = (n: number) => Math.round(n * 10) / 10
  const fill = (count: number, reps: number, weight: number) =>
    Array.from({ length: count }, () => ({ reps, weight_kg: round(weight) }))

  switch (suggestion.type) {
    case 'deload':
      return fill(sets, bestReps, bestWeight * 0.85)
    case 'increase_weight':
      // `generateSuggestion` bumps the weight *and* resets the rep target only
      // on the hypertrophy branch, and only once the lifter has topped out its
      // rep ceiling; that same condition is what its "…kg × 8 reps" copy is
      // built from. Derive it from the inputs rather than sniffing the string
      // out of user-facing copy — a wording change there used to silently drop
      // the reset. The focus check matters too: a strength lifter told to "add
      // 2.5kg" at 12 reps was being handed 8-rep sets the copy never mentioned.
      return fill(
        sets,
        trainingFocus === 'hypertrophy' && bestReps >= HYPERTROPHY_REP_CEILING
          ? HYPERTROPHY_REP_RESET
          : bestReps,
        bestWeight + 2.5,
      )
    case 'increase_reps':
      return fill(sets, bestReps + 1, bestWeight)
    case 'increase_sets':
      // Clamp *after* the increment: `sets` is already ≤ MAX_SETS, so adding one
      // first used to hand back 11 sets from a function that caps at 10.
      return fill(Math.min(sets + 1, MAX_SETS), bestReps, bestWeight)
    case 'maintain':
    default:
      return fill(sets, bestReps, bestWeight)
  }
}
