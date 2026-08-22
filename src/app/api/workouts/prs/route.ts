import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { withUser, optionalInt } from '@/lib/api-handler'

export const GET = withUser(async (request, user) => {
  const days = optionalInt(request.nextUrl.searchParams.get('days'), 'days', { min: 1, max: 365 })
  const all = request.nextUrl.searchParams.get('all') === '1'

  const whereClause: Prisma.ProgressSnapshotWhereInput = {
    user_id: user.id,
  }

  if (!all) {
    // `?days=7` means seven calendar days *including today*, matching /steps and
    // /runs/history. Subtracting `days` from today's UTC midnight returned
    // `days + 1` days.
    const startDate = new Date()
    startDate.setUTCHours(0, 0, 0, 0)
    startDate.setUTCDate(startDate.getUTCDate() - ((days ?? 7) - 1))
    // Every row here is rendered as a *weight* PR, so the window has to be the
    // weight record's own clock. `last_improved_at` also moves on an e1RM-only
    // improvement, which dragged stale weight records into the recent list.
    whereClause.best_weight_improved_at = { gte: startDate }
  }

  const snapshots = await prisma.progressSnapshot.findMany({
    where: whereClause,
    // Nulls last so `?all=1` rows that have never recorded a weight PR (or
    // pre-backfill rows) sort to the bottom rather than the top.
    orderBy: { best_weight_improved_at: { sort: 'desc', nulls: 'last' } },
    take: all ? 100 : 10,
  })

  // Filter out snapshots for exercises that no longer have any logged data
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
      // `best_weight` is the genuinely heaviest set, not the best-e1RM set's
      // weight — the old value could go *down* while claiming a new weight PR.
      value: `${s.best_weight}kg × ${s.best_weight_reps}`,
      volume: Math.round(s.total_volume_7d),
      // The date the *weight* record was set, not the last time anything about
      // this lift improved — the value above is a weight PR, so it must not be
      // dated by an e1RM-only session that never touched `best_weight`.
      // null (not '') when no weight PR has ever been recorded —
      // `new Date('')` is what rendered "Invalid Date" in the PR lists.
      date: s.best_weight_improved_at?.toISOString().split('T')[0] ?? null,
    }))

  return NextResponse.json({ prs })
})
