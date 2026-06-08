import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWeeklyExerciseDigest } from '@/lib/ai'
import type { AIProvider } from '@/lib/models'
import { decrypt } from '@/lib/crypto'
import { Bot } from 'grammy'

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? ''
const CRON_SECRET = process.env.CRON_SECRET ?? ''

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
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { ai_features_enabled: true },
  })

  const bot = new Bot(BOT_TOKEN)
  let sent = 0

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  for (const user of users) {
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null
    if (coachPrefs?.weekly_exercise_digest === false) continue

    const creds = getAICredentials(user)
    if (!creds) continue

    try {
      const [thisWeekWorkouts, lastWeekWorkouts, snapshots] = await Promise.all([
        prisma.workoutLog.findMany({
          where: { user_id: user.id, workout_date: { gte: sevenDaysAgo } },
          include: { exercises: true },
        }),
        prisma.workoutLog.findMany({
          where: { user_id: user.id, workout_date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
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
            const primaryMuscles = dbExercise
              ? (dbExercise.primary_muscles as string[])
              : ['unknown']
            for (const m of primaryMuscles) {
              muscles[m] = (muscles[m] ?? 0) + sets
            }
          }
        }
        return muscles
      }

      const thisWeekMuscles = getMuscleSets(thisWeekWorkouts)
      const lastWeekMuscles = getMuscleSets(lastWeekWorkouts)

      const volumeBreakdown = Object.entries(thisWeekMuscles)
        .map(([muscle, sets]) => {
          const lastSets = lastWeekMuscles[muscle] ?? 0
          const diff = lastSets > 0 ? Math.round(((sets - lastSets) / lastSets) * 100) : 0
          const arrow = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : '='
          return `${muscle}: ${sets} sets (${arrow} vs last week)`
        })
        .join('\n')

      const stallAlerts = snapshots
        .filter(s => s.sessions_since_improvement >= 3)
        .map(s => `${s.exercise_name}: stalled ${s.sessions_since_improvement} sessions (1RM: ${s.estimated_1rm}kg)`)
        .join('\n')

      // Calculate streak
      let streak = 0
      const sortedDates = thisWeekWorkouts
        .map(w => w.workout_date.toISOString().split('T')[0])
        .sort()
        .reverse()
      const uniqueDates = [...new Set(sortedDates)]
      for (let i = 0; i < uniqueDates.length; i++) {
        const expected = new Date(now)
        expected.setDate(expected.getDate() - i)
        if (uniqueDates[i] === expected.toISOString().split('T')[0]) {
          streak++
        } else break
      }

      const message = await generateWeeklyExerciseDigest(creds.provider, creds.apiKey, creds.model, {
        trainingFocus: user.training_focus ?? 'general fitness',
        sessionCount: thisWeekWorkouts.length,
        streak,
        volumeBreakdown,
        stallAlerts,
      })

      await bot.api.sendMessage(
        Number(user.telegram_id),
        `\u{1F4AA} <b>Weekly Training Digest</b>\n\n${message}`,
        { parse_mode: 'HTML' },
      )
      sent++
    } catch (err) {
      console.error(`Weekly exercise digest failed for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: users.length })
}
