import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, getUserAICredentials } from '@/lib/auth'
import { generateWorkoutAnalysis } from '@/lib/ai'
import { updateProgressAfterWorkout } from '@/lib/progress'
import { Bot } from 'grammy'

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? ''

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(request)
    const workoutId = parseInt(params.id, 10)

    const workout = await prisma.workoutLog.findFirst({
      where: { id: workoutId, user_id: user.id },
      include: { exercises: { orderBy: { order: 'asc' } } },
    })

    if (!workout) {
      return NextResponse.json({ detail: 'Workout not found' }, { status: 404 })
    }

    if (workout.analysis) {
      return NextResponse.json(workout.analysis)
    }

    const { provider, apiKey, model } = getUserAICredentials(user)

    const { prs } = await updateProgressAfterWorkout(user.id, workoutId)

    const snapshots = await prisma.progressSnapshot.findMany({
      where: {
        user_id: user.id,
        exercise_name: { in: workout.exercises.map(e => e.exercise_name) },
      },
    })

    const progressContext = snapshots.map(s =>
      `${s.exercise_name}: 1RM=${s.estimated_1rm}kg, ${s.sessions_since_improvement === 0 ? 'just improved' : `${s.sessions_since_improvement} sessions since improvement`}`
    ).join('\n') || 'No prior history'

    const analysis = await generateWorkoutAnalysis(provider, apiKey, model, {
      workoutName: workout.name,
      exercises: workout.exercises.map(e => ({
        name: e.exercise_name,
        sets: e.sets as unknown as { reps: number; weight_kg: number | null }[],
      })),
      progressContext,
      trainingFocus: user.training_focus ?? 'general fitness',
      prs: prs.map(p => ({ exercise_name: p.exercise, type: p.type, value: p.value })),
    })

    await prisma.workoutLog.update({
      where: { id: workoutId },
      data: { analysis: analysis as unknown as import('@prisma/client').Prisma.InputJsonValue },
    })

    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null
    if (coachPrefs?.workout_analysis !== false && BOT_TOKEN) {
      try {
        const bot = new Bot(BOT_TOKEN)
        const prsText = analysis.prs.length > 0
          ? `\n🏆 ${analysis.prs.map((p: { exercise: string; value: string }) => `${p.exercise}: ${p.value}`).join(', ')}`
          : ''
        const msg = `💪 <b>${workout.name}</b>\n\n${analysis.volume_comparison}${prsText}\n\n${analysis.takeaway}`
        await bot.api.sendMessage(Number(user.telegram_id), msg, { parse_mode: 'HTML' })
      } catch (err) {
        console.error('Failed to send workout analysis via Telegram:', err)
      }
    }

    return NextResponse.json(analysis)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    if (message.includes('No API key')) {
      return NextResponse.json({ detail: message }, { status: 400 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
