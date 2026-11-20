import type { FoodLog, RunLog, StepLog, User, WorkoutLog } from '@prisma/client'
import { prisma } from './prisma'
import { calculateStepAllowance } from './steps'
import { dayKey, dayRange } from './day'
import { EXERCISE_DAMPENING } from './constants'

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
 * A "day" is the Singapore calendar day from `./day`.
 */

/** The user fields the budget calculation depends on. */
export type BudgetUser = Pick<
  User,
  'id' | 'daily_calorie_goal' | 'activity_level' | 'weight_kg'
>

/** A run row without `added_to_allowance` is credited. */
export type BudgetRunLog = Pick<RunLog, 'calories_burned'> &
  Partial<Pick<RunLog, 'added_to_allowance'>>

type MacroRow = Pick<FoodLog, 'calories' | 'protein' | 'carbohydrates' | 'fats' | 'fiber'>

/** Unrounded macro totals over food rows (null columns count as 0). */
export function sumMacros(logs: MacroRow[]) {
  const total = { calories: 0, protein: 0, carbohydrates: 0, fats: 0, fiber: 0 }
  for (const l of logs) {
    total.calories += l.calories ?? 0
    total.protein += l.protein ?? 0
    total.carbohydrates += l.carbohydrates ?? 0
    total.fats += l.fats ?? 0
    total.fiber += l.fiber ?? 0
  }
  return total
}

/** Raw log rows for a single day (only the fields the maths needs). */
export interface DailyBudgetInput {
  user: BudgetUser
  foodLogs: MacroRow[]
  runLogs: BudgetRunLog[]
  workoutLogs: Pick<WorkoutLog, 'calories_burned'>[]
  /** Step count for the day (0 when nothing was synced). */
  steps: number
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
  food: ReturnType<typeof sumMacros> & { meals_logged: number }
}

/** Pure budget maths over already-fetched logs. */
export function computeDailyBudget(input: DailyBudgetInput): DailyBudget {
  const { user, foodLogs, runLogs, workoutLogs, steps } = input

  const food = { ...sumMacros(foodLogs), meals_logged: foodLogs.length }

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
  /** The day as `YYYY-MM-DD`. */
  date: string
  /** Total water logged that day, in litres (not part of the calorie budget). */
  water_liters: number
  /** The rows the budget was derived from, so callers need not refetch. */
  logs: {
    food: FoodLog[]
    workouts: WorkoutLog[]
    /** Every run that day, including ones not counted toward the allowance. */
    runs: RunLog[]
    /** Latest step sync for the day, or null if never synced. */
    step: StepLog | null
  }
}

/** Fetch one day's logs (`key` is `YYYY-MM-DD`, default today) and compute the canonical budget. */
export async function getDailyBudget(
  user: BudgetUser,
  key: string = dayKey(),
): Promise<DailyBudgetResult> {
  const { start, end } = dayRange(key)

  const [foodLogs, waterLogs, runLogs, workoutLogs, stepLog] = await Promise.all([
    prisma.foodLog.findMany({
      where: { user_id: user.id, logged_at: { gte: start, lt: end } },
    }),
    prisma.waterLog.findMany({
      where: { user_id: user.id, logged_at: { gte: start, lt: end } },
    }),
    prisma.runLog.findMany({
      where: { user_id: user.id, run_date: { gte: start, lt: end } },
    }),
    prisma.workoutLog.findMany({
      where: { user_id: user.id, workout_date: { gte: start, lt: end } },
    }),
    prisma.stepLog.findFirst({
      where: { user_id: user.id, date: new Date(`${key}T00:00:00Z`) },
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
    date: key,
    water_liters: waterLogs.reduce((s, l) => s + l.amount_liters, 0),
    logs: {
      food: foodLogs,
      workouts: workoutLogs,
      runs: runLogs,
      step: stepLog,
    },
  }
}
