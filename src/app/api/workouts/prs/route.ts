import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { withUser, optionalInt } from '@/lib/api-handler'
import { dayKey, daysAgoStart } from '@/lib/day'

export const GET = withUser(async (request, user) => {
  const days = optionalInt(request.nextUrl.searchParams.get('days'), 'days', { min: 1, max: 365 })
  const all = request.nextUrl.searchParams.get('all') === '1'

  const whereClause: Prisma.ProgressSnapshotWhereInput = {
    user_id: user.id,
  }

  if (!all) {
    // `?days=7` is seven calendar days including today, matching /steps and /runs/history.
    const startDate = daysAgoStart((days ?? 7) - 1)
    // Window on the weight record's own clock: `last_improved_at` also moves on e1RM-only sessions.
    whereClause.best_weight_improved_at = { gte: startDate }
  }

  const snapshots = await prisma.progressSnapshot.findMany({
    where: whereClause,
    // Nulls last, so rows that never recorded a weight PR sort to the bottom.
    orderBy: { best_weight_improved_at: { sort: 'desc', nulls: 'last' } },
    take: all ? 100 : 10,
  })

  // Hides orphan snapshots (older rows, or a failed post-delete rebuild) whose lift has no logs left.
  const exerciseNames = snapshots.map(s => s.exercise_name)
  const existingExercises = exerciseNames.length
    ? await prisma.exerciseLog.findMany({
        where: {
          exercise_name: { in: exerciseNames },
          workout: { user_id: user.id },
        },
        select: { exercise_name: true },
        distinct: ['exercise_name'],
      })
    : []
  const validNames = new Set(existingExercises.map(e => e.exercise_name))

  const prs = snapshots
    .filter(s => validNames.has(s.exercise_name))
    .slice(0, all ? 100 : 5)
    .map(s => ({
      exercise_name: s.exercise_name,
      type: 'weight' as const,
      // The heaviest set, not the best-e1RM set's weight.
      value: `${s.best_weight}kg × ${s.best_weight_reps}`,
      volume: Math.round(s.total_volume_7d),
      // The weight record's date, not `last_improved_at`; null (not '') so `new Date('')` can't render "Invalid Date".
      date: s.best_weight_improved_at ? dayKey(s.best_weight_improved_at) : null,
    }))

  return NextResponse.json({ prs })
})
