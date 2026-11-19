import type { StepLog, User } from '@prisma/client'
import { prisma } from './prisma'
import { generateDailyCoach, generateWeeklyInsights } from './ai'
import { parseJsonStringArray } from './api-handler'
import { sumMacros, type DailyBudgetResult } from './budget'
import { addDays, dayKey, dayRange } from './day'
import type { AICredentials } from './models'

export type NudgeTopic = 'inactivity' | 'recovery' | 'nutrition_gap' | 'consistency' | 'steps'

interface NudgeHistoryEntry {
  topic: string
  sent_at: string
}

/** Internal — the coach state row is an implementation detail of this module. */
async function getCoachState(userId: number) {
  return prisma.coachState.upsert({
    where: { user_id: userId },
    update: {},
    create: { user_id: userId },
  })
}

export async function recordNudge(userId: number, topic: NudgeTopic) {
  const state = await getCoachState(userId)
  const history = Array.isArray(state.nudge_history) ? (state.nudge_history as unknown as NudgeHistoryEntry[]) : []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const recentHistory = history.filter(h => new Date(h.sent_at) > cutoff)
  recentHistory.push({ topic, sent_at: new Date().toISOString() })

  await prisma.coachState.update({
    where: { user_id: userId },
    data: {
      last_nudge_topic: topic,
      last_nudge_at: new Date(),
      nudge_history: recentHistory as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  })
}

/** Internal — 48 h per-topic cooldown, read from `CoachState.nudge_history`. */
function wasNudgedRecently(state: { nudge_history: unknown }, topic: NudgeTopic, hoursAgo: number = 48): boolean {
  const history: NudgeHistoryEntry[] = Array.isArray(state.nudge_history) ? state.nudge_history as NudgeHistoryEntry[] : []
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - hoursAgo)
  return history.some(h => h.topic === topic && new Date(h.sent_at) > cutoff)
}

/**
 * @param budget      today's canonical budget (`getDailyBudget`)
 * @param recentSteps step logs the caller already fetched; only the last 7 days are read
 */
export async function determineNudgeTopic(
  userId: number,
  stepGoal: number,
  coachPrefs: Record<string, boolean> | null,
  budget: DailyBudgetResult,
  recentSteps: Pick<StepLog, 'date' | 'steps'>[],
): Promise<NudgeTopic | null> {
  const state = await getCoachState(userId)

  const now = new Date()
  const fiveDaysAgo = new Date(now)
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
  const twoDaysAgo = new Date(now)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Fetch the full 7-day window (the "3+ this week" rule needs it); narrower ones are derived in JS.
  const weekWorkouts = await prisma.workoutLog.findMany({ where: { user_id: userId, workout_date: { gte: sevenDaysAgo } } })
  const recentWorkouts = weekWorkouts.filter(w => w.workout_date >= fiveDaysAgo)
  const stepLogs = recentSteps.filter(l => l.date >= sevenDaysAgo)

  // Priority 1: Inactivity (no workout in 5+ days)
  if (recentWorkouts.length === 0 && !wasNudgedRecently(state, 'inactivity') && coachPrefs?.nudge_inactivity !== false) {
    return 'inactivity'
  }

  // Priority 2: Nutrition gap (exercised today but low intake). Raw burn, and
  // only runs the user left counted toward the allowance — same as the budget.
  const totalBurn = budget.runs_raw + budget.workouts_raw
  if (totalBurn > 300 && budget.food.calories < 1500 && !wasNudgedRecently(state, 'nutrition_gap') && coachPrefs?.nudge_nutrition_gap !== false) {
    return 'nutrition_gap'
  }

  // Priority 3: Recovery warning (3+ workouts in last 2 days)
  const lastTwoDayWorkouts = recentWorkouts.filter(w => w.workout_date >= twoDaysAgo)
  if (lastTwoDayWorkouts.length >= 3 && !wasNudgedRecently(state, 'recovery') && coachPrefs?.nudge_recovery !== false) {
    return 'recovery'
  }

  // Priority 4: Step motivation
  if (stepLogs.length >= 3 && coachPrefs?.nudge_steps !== false) {
    const today = budget.logs.step
    if (stepGoal && today && today.steps < stepGoal * 0.5 && !wasNudgedRecently(state, 'steps')) {
      return 'steps'
    } else if (!stepGoal) {
      const avg = stepLogs.reduce((s, l) => s + l.steps, 0) / stepLogs.length
      if (today && today.steps < avg * 0.5 && !wasNudgedRecently(state, 'steps')) {
        return 'steps'
      }
    }
  }

  // Priority 5: Consistency praise (3+ workouts this week)
  if (weekWorkouts.length >= 3 && !wasNudgedRecently(state, 'consistency') && coachPrefs?.nudge_consistency !== false) {
    return 'consistency'
  }

  return null
}

/** The daily coach message for `budget` (today's `getDailyBudget`). */
export function buildDailyCoach(
  user: User,
  ai: AICredentials,
  budget: DailyBudgetResult,
  stepStreak: number,
): Promise<string> {
  return generateDailyCoach(ai, {
    // Exercise/step credits are already folded into total_goal.
    goals: { calories: Math.round(budget.total_goal), protein: user.daily_protein_goal },
    consumed: {
      calories: Math.round(budget.food.calories),
      protein: Math.round(budget.food.protein),
      carbs: Math.round(budget.food.carbohydrates),
      fats: Math.round(budget.food.fats),
    },
    meals: budget.logs.food.map(l => l.food_name).filter((n): n is string => !!n),
    waterConsumed: budget.water_liters,
    waterGoal: user.daily_water_goal,
    // Raw burn is what the coach talks about; the dampened half is already in `total_goal`, so don't add it twice.
    exerciseCalories: budget.runs_raw + budget.workouts_raw,
    dietaryRestrictions: parseJsonStringArray(user.dietary_restrictions),
    steps: {
      today: budget.steps,
      goal: user.daily_step_goal,
      streak: stepStreak,
      extraAllowance: budget.steps_credit,
    },
  })
}

/** Weekly insights over the 7 complete days before today, or null when no meals were logged. */
export async function buildWeeklyInsights(user: User, ai: AICredentials): Promise<string | null> {
  // [day-7 00:00, today 00:00): today is still in progress and would drag averages down.
  const today = dayKey()
  const todayStart = dayRange(today).start
  const weekStart = dayRange(addDays(today, -7)).start

  const [foodLogs, waterLogs, runLogs, workoutLogs] = await Promise.all([
    prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart, lt: todayStart } } }),
    prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart, lt: todayStart } } }),
    prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: weekStart, lt: todayStart } } }),
    // Gym sessions count as exercise too, not just runs.
    prisma.workoutLog.findMany({ where: { user_id: user.id, workout_date: { gte: weekStart, lt: todayStart } } }),
  ])

  if (foodLogs.length === 0) return null

  const days: { date: string; calories: number; protein: number; water: number }[] = []
  for (let i = 7; i >= 1; i--) {
    const dateStr = addDays(today, -i)
    const dayFood = foodLogs.filter(l => dayKey(l.logged_at) === dateStr)
    const dayWater = waterLogs.filter(l => dayKey(l.logged_at) === dateStr)
    const m = sumMacros(dayFood)

    days.push({
      date: dateStr,
      calories: Math.round(m.calories),
      protein: Math.round(m.protein),
      water: dayWater.reduce((s, l) => s + l.amount_liters, 0),
    })
  }

  return generateWeeklyInsights(ai, {
    goals: { calories: user.daily_calorie_goal, protein: user.daily_protein_goal, water: user.daily_water_goal },
    days,
    // Runs + gym sessions, over the same [weekStart, todayStart) window.
    exerciseTotal:
      runLogs.reduce((s, r) => s + r.calories_burned, 0) +
      workoutLogs.reduce((s, w) => s + (w.calories_burned ?? 0), 0),
    exerciseSessions: runLogs.length + workoutLogs.length,
    dietaryRestrictions: parseJsonStringArray(user.dietary_restrictions),
  })
}
