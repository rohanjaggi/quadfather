import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(request)
    const id = parseInt(params.id, 10)

    const workout = await prisma.workoutLog.findFirst({
      where: { id, user_id: user.id },
      include: { exercises: { orderBy: { order: 'asc' } } },
    })

    if (!workout) {
      return NextResponse.json({ detail: 'Workout not found' }, { status: 404 })
    }

    return NextResponse.json(workout)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(request)
    const id = parseInt(params.id, 10)

    const existing = await prisma.workoutLog.findFirst({
      where: { id, user_id: user.id },
    })
    if (!existing) {
      return NextResponse.json({ detail: 'Workout not found' }, { status: 404 })
    }

    const exercises = await prisma.exerciseLog.findMany({
      where: { workout_log_id: id },
      select: { exercise_name: true },
    })

    await prisma.workoutLog.delete({ where: { id } })

    // Clean up orphaned progress snapshots for exercises that no longer have any logs
    const exerciseNames = [...new Set(exercises.map(e => e.exercise_name))]
    for (const name of exerciseNames) {
      const remaining = await prisma.exerciseLog.count({
        where: { exercise_name: name, workout: { user_id: user.id } },
      })
      if (remaining === 0) {
        await prisma.progressSnapshot.deleteMany({
          where: { user_id: user.id, exercise_name: name },
        })
      }
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
