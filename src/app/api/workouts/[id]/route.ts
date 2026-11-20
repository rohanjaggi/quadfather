import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recomputeSnapshotsForExercises } from '@/lib/progress'
import { withUser, requireInt, notFound } from '@/lib/api-handler'

type Ctx = { params: { id: string } }

export const DELETE = withUser<Ctx>(async (request, user, { params }) => {
  const id = requireInt(params.id, 'id')

  const existing = await prisma.workoutLog.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })
  if (!existing) throw notFound('Workout not found')

  const exercises = await prisma.exerciseLog.findMany({
    where: { workout_log_id: id },
    select: { exercise_name: true },
  })
  const exerciseNames = [...new Set(exercises.map(e => e.exercise_name))]

  await prisma.workoutLog.delete({ where: { id } })

  // Rebuild every affected snapshot from what survives. A failure here must not
  // turn a successful delete into a 500.
  try {
    await recomputeSnapshotsForExercises(user.id, exerciseNames)
  } catch (err) {
    console.error('Snapshot recompute after workout delete failed:', err)
  }

  return new NextResponse(null, { status: 204 })
})
