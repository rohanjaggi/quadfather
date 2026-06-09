import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const daysParam = request.nextUrl.searchParams.get('days')
    const all = request.nextUrl.searchParams.get('all') === '1'

    const whereClause: Prisma.ProgressSnapshotWhereInput = {
      user_id: user.id,
    }

    if (!all && daysParam) {
      const days = parseInt(daysParam, 10)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setUTCHours(0, 0, 0, 0)
      whereClause.last_improved_at = { gte: startDate }
    } else if (!all) {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      startDate.setUTCHours(0, 0, 0, 0)
      whereClause.last_improved_at = { gte: startDate }
    }

    const snapshots = await prisma.progressSnapshot.findMany({
      where: whereClause,
      orderBy: { last_improved_at: 'desc' },
      take: all ? 100 : 10,
    })

    // Filter out snapshots for exercises that no longer have any logged data
    const exerciseNames = snapshots.map(s => s.exercise_name)
    const existingExercises = await prisma.exerciseLog.findMany({
      where: {
        exercise_name: { in: exerciseNames },
        workout: { user_id: user.id },
      },
      select: { exercise_name: true },
      distinct: ['exercise_name'],
    })
    const validNames = new Set(existingExercises.map(e => e.exercise_name))

    const prs = snapshots
      .filter(s => validNames.has(s.exercise_name))
      .slice(0, all ? 100 : 5)
      .map(s => ({
        exercise_name: s.exercise_name,
        type: 'weight' as const,
        value: `${s.best_set_weight}kg`,
        volume: Math.round(s.total_volume_7d),
        date: s.last_improved_at?.toISOString().split('T')[0] ?? '',
      }))

    return NextResponse.json({ prs })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
