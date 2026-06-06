import { prisma } from './prisma'

export type NudgeTopic = 'inactivity' | 'recovery' | 'nutrition_gap' | 'consistency' | 'steps'

interface NudgeHistoryEntry {
  topic: string
  sent_at: string
}

export async function getCoachState(userId: number) {
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

export function wasNudgedRecently(state: { nudge_history: unknown }, topic: NudgeTopic, hoursAgo: number = 48): boolean {
  const history: NudgeHistoryEntry[] = Array.isArray(state.nudge_history) ? state.nudge_history as NudgeHistoryEntry[] : []
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - hoursAgo)
  return history.some(h => h.topic === topic && new Date(h.sent_at) > cutoff)
}

export async function determineNudgeTopic(userId: number, stepGoal?: number, coachPrefs?: Record<string, boolean> | null): Promise<NudgeTopic | null> {
  const state = await getCoachState(userId)

  const now = new Date()
  const fiveDaysAgo = new Date(now)
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
  const twoDaysAgo = new Date(now)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [recentWorkouts, todayFood, todayRuns, stepLogs] = await Promise.all([
    prisma.workoutLog.findMany({ where: { user_id: userId, workout_date: { gte: fiveDaysAgo } } }),
    prisma.foodLog.findMany({ where: { user_id: userId, logged_at: { gte: todayStart } } }),
    prisma.runLog.findMany({ where: { user_id: userId, run_date: { gte: todayStart } } }),
    prisma.stepLog.findMany({ where: { user_id: userId, date: { gte: sevenDaysAgo } }, orderBy: { date: 'desc' } }),
  ])

  // Priority 1: Inactivity (no workout in 5+ days)
  if (recentWorkouts.length === 0 && !wasNudgedRecently(state, 'inactivity') && coachPrefs?.nudge_inactivity !== false) {
    return 'inactivity'
  }

  // Priority 2: Nutrition gap (exercised today but low intake)
  const todayCalories = todayFood.reduce((s, l) => s + (l.calories ?? 0), 0)
  const todayBurn = todayRuns.reduce((s, r) => s + r.calories_burned, 0)
  const todayWorkoutBurn = recentWorkouts
    .filter(w => w.workout_date >= todayStart)
    .reduce((s, w) => s + (w.calories_burned ?? 0), 0)
  const totalBurn = todayBurn + todayWorkoutBurn
  if (totalBurn > 300 && todayCalories < 1500 && !wasNudgedRecently(state, 'nutrition_gap') && coachPrefs?.nudge_nutrition_gap !== false) {
    return 'nutrition_gap'
  }

  // Priority 3: Recovery warning (2+ workouts in last 2 days)
  const lastTwoDayWorkouts = recentWorkouts.filter(w => w.workout_date >= twoDaysAgo)
  if (lastTwoDayWorkouts.length >= 3 && !wasNudgedRecently(state, 'recovery') && coachPrefs?.nudge_recovery !== false) {
    return 'recovery'
  }

  // Priority 4: Step motivation
  if (stepLogs.length >= 3 && coachPrefs?.nudge_steps !== false) {
    const today = stepLogs.find(l => l.date >= todayStart)
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
  const weekWorkouts = recentWorkouts.filter(w => w.workout_date >= sevenDaysAgo)
  if (weekWorkouts.length >= 3 && !wasNudgedRecently(state, 'consistency') && coachPrefs?.nudge_consistency !== false) {
    return 'consistency'
  }

  return null
}
