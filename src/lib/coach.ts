import type { StepLog, User } from '@prisma/client'
import { prisma } from './prisma'
import { generateDailyCoach, generateWeeklyExerciseDigest, generateWeeklyInsights } from './ai'
import { parseJsonStringArray } from './api-handler'
import { sumMacros, type DailyBudgetResult } from './budget'
import { addDays, dayKey, dayRange, daysAgoStart } from './day'
import { formatInt } from './format'
import { escapeHtml } from './html'
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
 * Every nudge is opt-in: only a stored `true` enables it.
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
  if (recentWorkouts.length === 0 && !wasNudgedRecently(state, 'inactivity') && coachPrefs?.nudge_inactivity === true) {
    return 'inactivity'
  }

  // Priority 2: Nutrition gap (exercised today but low intake). Raw burn, and
  // only runs the user left counted toward the allowance — same as the budget.
  const totalBurn = budget.runs_raw + budget.workouts_raw
  if (totalBurn > 300 && budget.food.calories < 1500 && !wasNudgedRecently(state, 'nutrition_gap') && coachPrefs?.nudge_nutrition_gap === true) {
    return 'nutrition_gap'
  }

  // Priority 3: Recovery warning (3+ workouts in last 2 days)
  const lastTwoDayWorkouts = recentWorkouts.filter(w => w.workout_date >= twoDaysAgo)
  if (lastTwoDayWorkouts.length >= 3 && !wasNudgedRecently(state, 'recovery') && coachPrefs?.nudge_recovery === true) {
    return 'recovery'
  }

  // Priority 4: Step motivation
  if (stepLogs.length >= 3 && coachPrefs?.nudge_steps === true) {
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
  if (weekWorkouts.length >= 3 && !wasNudgedRecently(state, 'consistency') && coachPrefs?.nudge_consistency === true) {
    return 'consistency'
  }

  return null
}

export interface CloseTheDayInput {
  kcal: number
  /** `budget.total_goal`: the calorie goal plus today's exercise and step credit. */
  kcalBudget: number
  protein: number
  proteinGoal: number
  waterLiters: number
  waterGoal: number
  /** `null` when no steps were synced today. */
  steps: number | null
  stepGoal: number
  meals: number
  /** Names of today's workouts and runs. */
  sessions: string[]
}

/** The evening "close the day" summary: the day's numbers, no AI. `hasLogs` false is the short nothing-logged version. */
export function buildCloseTheDay(d: CloseTheDayInput): { html: string; hasLogs: boolean } {
  // Steps sync on their own, so they alone don't count as the user having logged anything.
  const hasLogs = d.meals > 0 || d.waterLiters > 0 || d.sessions.length > 0
  if (!hasLogs) return { html: '\u{1F319} Nothing logged today. Anything to add?', hasLogs }

  const left = Math.round(d.kcalBudget) - Math.round(d.kcal)
  const lines = [
    `Eaten: ${formatInt(d.kcal)} of ${formatInt(d.kcalBudget)} kcal, ${left < 0 ? `${formatInt(-left)} over` : `${formatInt(left)} left`}`,
    `Protein: ${formatInt(d.protein)} of ${formatInt(d.proteinGoal)} g`,
    `Water: ${+d.waterLiters.toFixed(1)} of ${+d.waterGoal.toFixed(1)} L`,
  ]
  if (d.steps !== null) lines.push(`Steps: ${formatInt(d.steps)} of ${formatInt(d.stepGoal)}`)
  if (d.sessions.length > 0) lines.push(`Trained: ${d.sessions.map(escapeHtml).join(', ')}`)

  return { html: `\u{1F319} <b>Your day</b>\n\n${lines.join('\n')}\n\nAnything missing?`, hasLogs }
}

/** The daily coach message for `budget` (today's `getDailyBudget`). */
export function buildDailyCoach(
  user: User,
  ai: AICredentials,
  budget: DailyBudgetResult,
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

/** Exercises with no `exercise_id` can't be mapped to a muscle group. */
const UNCATEGORISED = 'uncategorised'

/**
 * Consecutive days ending yesterday on which a workout was logged: the weekly letter goes out
 * Monday morning, so requiring one today would read 0.
 */
function workoutStreakEndingYesterday(workoutDates: Date[]): number {
  const days = new Set(workoutDates.map(d => dayKey(d)))
  const today = dayKey()

  let streak = 0
  // Bounded by the number of distinct days fetched.
  for (let back = 1; back <= days.size; back++) {
    if (!days.has(addDays(today, -back))) break
    streak++
  }
  return streak
}

/** The weekly letter's training section over the 7 complete days before today, or null when the user didn't train. */
export async function buildWeeklyTraining(user: User, ai: AICredentials): Promise<string | null> {
  // Whole days like the insights: this week is [today-7, today), last week [today-14, today-7).
  const todayStart = daysAgoStart(0)
  const weekStart = daysAgoStart(7)
  const prevWeekStart = daysAgoStart(14)

  const [thisWeekWorkouts, lastWeekWorkouts] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { user_id: user.id, workout_date: { gte: weekStart, lt: todayStart } },
      include: { exercises: true },
    }),
    prisma.workoutLog.findMany({
      where: { user_id: user.id, workout_date: { gte: prevWeekStart, lt: weekStart } },
      include: { exercises: true },
    }),
  ])
  if (thisWeekWorkouts.length === 0) return null

  // Only exercises still being logged: a long-dropped lift is not "stalled".
  const recentNames = [...new Set(
    [...thisWeekWorkouts, ...lastWeekWorkouts].flatMap(w => w.exercises.map(e => e.exercise_name)),
  )]
  const snapshots = await prisma.progressSnapshot.findMany({
    where: { user_id: user.id, exercise_name: { in: recentNames } },
  })

  const exerciseIds = [...new Set(
    [...thisWeekWorkouts, ...lastWeekWorkouts]
      .flatMap(w => w.exercises.map(e => e.exercise_id))
      .filter((id): id is number => id != null),
  )]
  const exercises = exerciseIds.length > 0
    ? await prisma.exercise.findMany({ where: { id: { in: exerciseIds } } })
    : []
  const exerciseMap = new Map(exercises.map(e => [e.id, e]))

  function getMuscleSets(workouts: typeof thisWeekWorkouts): Record<string, number> {
    const muscles: Record<string, number> = {}
    for (const w of workouts) {
      for (const ex of w.exercises) {
        const sets = (ex.sets as unknown as { reps: number; weight_kg: number | null }[]).length
        const dbExercise = ex.exercise_id ? exerciseMap.get(ex.exercise_id) : null
        // Free-text exercises have no `exercise_id`, so no muscle; label them so the digest can say so.
        const rawMuscles = dbExercise?.primary_muscles
        const mapped = Array.isArray(rawMuscles)
          ? rawMuscles.filter((m): m is string => typeof m === 'string' && m.length > 0)
          : []
        const primaryMuscles = mapped.length > 0 ? mapped : [UNCATEGORISED]
        for (const m of primaryMuscles) {
          muscles[m] = (muscles[m] ?? 0) + sets
        }
      }
    }
    return muscles
  }

  const thisWeekMuscles = getMuscleSets(thisWeekWorkouts)
  const lastWeekMuscles = getMuscleSets(lastWeekWorkouts)

  // Union of both weeks so a muscle dropped entirely this week still shows up.
  const volumeBreakdown = [...new Set([
    ...Object.keys(thisWeekMuscles),
    ...Object.keys(lastWeekMuscles),
  ])]
    .sort((a, b) => (thisWeekMuscles[b] ?? 0) - (thisWeekMuscles[a] ?? 0) || a.localeCompare(b))
    .map(muscle => {
      const sets = thisWeekMuscles[muscle] ?? 0
      const lastSets = lastWeekMuscles[muscle] ?? 0
      if (sets === 0) {
        return `${muscle}: 0 sets this week (dropped — ${lastSets} sets last week)`
      }
      // No sets last week means no percentage to report.
      if (lastSets === 0) return `${muscle}: ${sets} sets (new this week)`
      const diff = Math.round(((sets - lastSets) / lastSets) * 100)
      const arrow = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : '='
      return `${muscle}: ${sets} sets (${arrow} vs last week)`
    })
    .join('\n')

  const stallAlerts = snapshots
    .filter(s => s.sessions_since_improvement >= 3)
    .map(s => `${s.exercise_name}: stalled ${s.sessions_since_improvement} sessions (1RM: ${s.estimated_1rm}kg)`)
    .join('\n')

  return generateWeeklyExerciseDigest(ai, {
    trainingFocus: user.training_focus ?? 'general fitness',
    sessionCount: thisWeekWorkouts.length,
    streak: workoutStreakEndingYesterday(thisWeekWorkouts.map(w => w.workout_date)),
    volumeBreakdown,
    stallAlerts,
  })
}
