import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWeeklyExerciseDigest } from '@/lib/ai'
import type { AIProvider } from '@/lib/models'
import { decrypt } from '@/lib/crypto'
import { escapeHtml } from '@/lib/html'
import { clampHtml } from '@/lib/telegram-bot'
import { checkCronAuth } from '../auth'
import { Bot } from 'grammy'

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? ''
const DAY_MS = 86400000

/** Exercises with no `exercise_id` can't be mapped to a muscle group. */
const UNCATEGORISED = 'uncategorised'

/**
 * Consecutive UTC days *ending yesterday* on which a workout was logged.
 *
 * Yesterday is the last day that can count: this digest runs in the small hours
 * UTC, so a streak that required a workout *today* would read 0 on essentially
 * every run — which is exactly what the old loop did (it started at today, the
 * date didn't match, and it broke out immediately). It also indexed the sorted
 * date list by the loop counter, so it compared the *n*-th distinct workout day
 * against "n days ago" and could count non-consecutive days as a streak.
 *
 * Deliberately a local copy of `stepStreakEndingYesterday` in the daily-coach
 * cron rather than a shared helper: the two read different tables, and
 * `lib/coach.ts` is about nudge state, not date arithmetic.
 */
function workoutStreakEndingYesterday(workoutDates: Date[], todayStart: Date): number {
  const days = new Set(workoutDates.map(d => d.toISOString().slice(0, 10)))

  let streak = 0
  // Bounded by the number of distinct days we fetched — the streak can never be
  // longer than that, and the loop always terminates.
  for (let back = 1; back <= days.size; back++) {
    const day = new Date(todayStart.getTime() - back * DAY_MS).toISOString().slice(0, 10)
    if (!days.has(day)) break
    streak++
  }
  return streak
}

function getAICredentials(user: { ai_provider: string | null; ai_api_key: string | null; ai_model: string | null }) {
  if (user.ai_provider && user.ai_api_key) {
    return { provider: user.ai_provider as AIProvider, apiKey: decrypt(user.ai_api_key), model: user.ai_model }
  }
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) return { provider: 'gemini' as AIProvider, apiKey: geminiKey, model: null as string | null }
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (openrouterKey) return { provider: 'openrouter' as AIProvider, apiKey: openrouterKey, model: null as string | null }
  return null
}

export async function GET(request: NextRequest) {
  const authFailure = checkCronAuth(request)
  if (authFailure) return authFailure

  const users = await prisma.user.findMany({
    where: { ai_features_enabled: true },
  })

  const bot = new Bot(BOT_TOKEN)
  let sent = 0

  // Whole UTC days, like the sibling crons: this week is [today-7, today) and
  // last week is [today-14, today-7). The old rolling `now - 7d` window carried
  // the time of day, so a session logged this morning last Monday landed in
  // whichever half the run happened to start in, and "this week vs last week"
  // compared two windows that both straddled the same day.
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const weekStart = new Date(todayStart.getTime() - 7 * DAY_MS)
  const prevWeekStart = new Date(todayStart.getTime() - 14 * DAY_MS)

  for (const user of users) {
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null
    if (coachPrefs?.weekly_exercise_digest === false) continue

    try {
      // Inside the per-user try: `getAICredentials` calls `decrypt`, which throws
      // on a rotated ENCRYPTION_KEY, a corrupt ciphertext, or a legacy plaintext
      // key. Outside, that throw escaped the loop and 500'd the whole cron, so
      // one user with an unreadable key meant *nobody* got their digest.
      const creds = getAICredentials(user)
      if (!creds) continue

      const [thisWeekWorkouts, lastWeekWorkouts, snapshots] = await Promise.all([
        prisma.workoutLog.findMany({
          where: { user_id: user.id, workout_date: { gte: weekStart, lt: todayStart } },
          include: { exercises: true },
        }),
        prisma.workoutLog.findMany({
          where: { user_id: user.id, workout_date: { gte: prevWeekStart, lt: weekStart } },
          include: { exercises: true },
        }),
        prisma.progressSnapshot.findMany({
          where: { user_id: user.id },
        }),
      ])

      if (thisWeekWorkouts.length === 0) continue

      // Get exercises for muscle mapping
      const exerciseIds = [...new Set(
        [...thisWeekWorkouts, ...lastWeekWorkouts]
          .flatMap(w => w.exercises.map(e => e.exercise_id))
          .filter((id): id is number => id != null)
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
            // Free-text exercises carry no `exercise_id` and so no muscle
            // mapping. They used to be filed under a literal "unknown", which
            // reached the model as a muscle group ("unknown: 6 sets"); label
            // them for what they are so the digest can say so plainly.
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

      // Union of both weeks, not just this week's keys: a muscle trained last
      // week and dropped entirely this week simply vanished from the list, so
      // the one imbalance the digest most needs to flag was the one it could
      // never see.
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
          // A muscle with no sets last week has no percentage to report — it
          // used to render as "=", which read as "unchanged" and told the model
          // the exact opposite of what happened.
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

      const streak = workoutStreakEndingYesterday(
        thisWeekWorkouts.map(w => w.workout_date),
        todayStart,
      )

      const message = await generateWeeklyExerciseDigest(creds.provider, creds.apiKey, creds.model, {
        trainingFocus: user.training_focus ?? 'general fitness',
        sessionCount: thisWeekWorkouts.length,
        streak,
        volumeBreakdown,
        stallAlerts,
      })

      // Telegram 400s past 4096 characters and this send has no fallback, so an
      // over-long model reply used to mean the user simply got no digest.
      await bot.api.sendMessage(
        Number(user.telegram_id),
        clampHtml(`\u{1F4AA} <b>Weekly Training Digest</b>\n\n${escapeHtml(message)}`),
        { parse_mode: 'HTML' },
      )
      sent++
    } catch (err) {
      console.error(`Weekly exercise digest failed for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: users.length })
}
