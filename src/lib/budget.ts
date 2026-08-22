import type { FoodLog, RunLog, StepLog, User, WaterLog, WorkoutLog } from '@prisma/client'
import { prisma } from './prisma'
import { calculateStepAllowance } from './steps'

/**
 * Single source of truth for "how many calories can I still eat today".
 *
 * Every surface (dashboard `/api/users/me`, meal suggestions, the daily coach
 * cron, the Telegram bot) must derive its numbers from here so they never
 * disagree. The canonical definition is:
 *
 *   total_goal = daily_calorie_goal
 *              + round(run burn   * 0.5)   // dampened: trackers over-report
 *              + round(workout burn * 0.5)
 *              + step allowance (steps above the activity-level baseline)
 *
 *   remaining = total_goal - calories eaten today
 *
 * A "day" is a UTC calendar day: [dayStart, dayEnd] where dayStart is
 * 00:00:00.000Z and dayEnd is 23:59:59.999Z.
 */

/**
 * Fraction of logged exercise burn credited back as extra food budget.
 * Fitness trackers over-report calorie burn, and the TDEE goal already assumes
 * some activity, so only half the reported burn is handed back.
 */
export { EXERCISE_DAMPENING } from './constants'
import { EXERCISE_DAMPENING } from './constants'

/** The user fields the budget calculation depends on. */
export type BudgetUser = Pick<
  User,
  'id' | 'daily_calorie_goal' | 'activity_level' | 'weight_kg'
>

/**
 * One run as far as the budget is concerned.
 *
 * `added_to_allowance` is optional so callers that only selected
 * `calories_burned` still typecheck; a row without the flag is credited.
 */
export type BudgetRunLog = Pick<RunLog, 'calories_burned'> &
  Partial<Pick<RunLog, 'added_to_allowance'>>

/** Raw log rows for a single day (only the fields the maths needs). */
export interface DailyBudgetInput {
  user: BudgetUser
  foodLogs: Pick<FoodLog, 'calories' | 'protein' | 'carbohydrates' | 'fats' | 'fiber'>[]
  runLogs: BudgetRunLog[]
  workoutLogs: Pick<WorkoutLog, 'calories_burned'>[]
  /** Step count for the day (0 when nothing was synced). */
  steps: number
}

export interface DailyFoodTotals {
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
  /** Number of food log entries for the day. */
  meals_logged: number
}

export interface DailyBudget {
  /** `user.daily_calorie_goal`, unrounded. */
  base: number
  /** Sum of `calories_burned` over runs that count toward the allowance. */
  runs_raw: number
  /** `round(runs_raw * EXERCISE_DAMPENING)` — what actually gets credited. */
  runs_credit: number
  /** Sum of workout `calories_burned`, unrounded. */
  workouts_raw: number
  /** `round(workouts_raw * EXERCISE_DAMPENING)` — what actually gets credited. */
  workouts_credit: number
  /** Extra kcal earned from steps above the activity-level baseline. */
  steps_credit: number
  /** `runs_credit + workouts_credit`. */
  exercise_burn: number
  /** `base + exercise_burn + steps_credit`, unrounded — round at the edge. */
  total_goal: number
  /** `total_goal - food.calories`, unrounded and NOT clamped at 0. */
  remaining: number
  /** Step count the allowance was computed from. */
  steps: number
  food: DailyFoodTotals
}

/**
 * Pure budget maths. Takes already-fetched logs so it can be unit-tested and
 * reused by callers that fetched the rows for other reasons.
 */
export function computeDailyBudget(input: DailyBudgetInput): DailyBudget {
  const { user, foodLogs, runLogs, workoutLogs, steps } = input

  const food: DailyFoodTotals = {
    calories: foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0),
    protein: foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0),
    carbohydrates: foodLogs.reduce((s, l) => s + (l.carbohydrates ?? 0), 0),
    fats: foodLogs.reduce((s, l) => s + (l.fats ?? 0), 0),
    fiber: foodLogs.reduce((s, l) => s + (l.fiber ?? 0), 0),
    meals_logged: foodLogs.length,
  }

  // `PATCH /runs/:id` lets a run be excluded from the allowance; the budget
  // used to credit every run regardless, which made that toggle a no-op.
  //
  // The column now defaults to `true` (migration 20260820000004) and both write
  // paths — `POST /runs` and the Strava sync — set it explicitly, so `false`
  // only ever means "the user switched this run off". A row that doesn't carry
  // the flag at all (a caller that selected only `calories_burned`) is credited.
  const runsRaw = runLogs
    .filter(r => r.added_to_allowance !== false)
    .reduce((s, r) => s + r.calories_burned, 0)
  const workoutsRaw = workoutLogs.reduce((s, w) => s + (w.calories_burned ?? 0), 0)
  const runsCredit = Math.round(runsRaw * EXERCISE_DAMPENING)
  const workoutsCredit = Math.round(workoutsRaw * EXERCISE_DAMPENING)
  const exerciseBurn = runsCredit + workoutsCredit

  const stepsCredit = calculateStepAllowance(steps, user.activity_level, user.weight_kg)

  const totalGoal = user.daily_calorie_goal + exerciseBurn + stepsCredit

  return {
    base: user.daily_calorie_goal,
    runs_raw: runsRaw,
    runs_credit: runsCredit,
    workouts_raw: workoutsRaw,
    workouts_credit: workoutsCredit,
    steps_credit: stepsCredit,
    exercise_burn: exerciseBurn,
    total_goal: totalGoal,
    remaining: totalGoal - food.calories,
    steps,
    food,
  }
}

export interface DailyBudgetResult extends DailyBudget {
  /** Start of the UTC day the budget covers (00:00:00.000Z). */
  day_start: Date
  /** End of the UTC day the budget covers (23:59:59.999Z). */
  day_end: Date
  /** `day_start` as `YYYY-MM-DD`. */
  date: string
  /** Total water logged that day, in litres (not part of the calorie budget). */
  water_liters: number
  /** The rows the budget was derived from, so callers need not refetch. */
  logs: {
    food: FoodLog[]
    water: WaterLog[]
    runs: RunLog[]
    workouts: WorkoutLog[]
    /** Latest step sync for the day, or null if never synced. */
    step: StepLog | null
  }
}

/** Normalise any Date to the start of its UTC calendar day. */
export function startOfUtcDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Fetch one day's logs and compute the canonical budget.
 *
 * @param user     the authenticated user (a full Prisma `User` works)
 * @param dayStart any Date within the wanted UTC day; defaults to today.
 */
export async function getDailyBudget(
  user: BudgetUser,
  dayStart?: Date,
): Promise<DailyBudgetResult> {
  const start = startOfUtcDay(dayStart)
  const end = new Date(start)
  end.setUTCHours(23, 59, 59, 999)

  const [foodLogs, waterLogs, runLogs, workoutLogs, stepLog] = await Promise.all([
    prisma.foodLog.findMany({
      where: { user_id: user.id, logged_at: { gte: start, lte: end } },
    }),
    prisma.waterLog.findMany({
      where: { user_id: user.id, logged_at: { gte: start, lte: end } },
    }),
    prisma.runLog.findMany({
      where: { user_id: user.id, run_date: { gte: start, lte: end } },
    }),
    prisma.workoutLog.findMany({
      where: { user_id: user.id, workout_date: { gte: start, lte: end } },
    }),
    prisma.stepLog.findFirst({
      where: { user_id: user.id, date: start },
      orderBy: { logged_at: 'desc' },
    }),
  ])

  const budget = computeDailyBudget({
    user,
    foodLogs,
    runLogs,
    workoutLogs,
    steps: stepLog?.steps ?? 0,
  })

  return {
    ...budget,
    day_start: start,
    day_end: end,
    date: start.toISOString().split('T')[0],
    water_liters: waterLogs.reduce((s, l) => s + l.amount_liters, 0),
    logs: {
      food: foodLogs,
      water: waterLogs,
      runs: runLogs,
      workouts: workoutLogs,
      step: stepLog,
    },
  }
}
