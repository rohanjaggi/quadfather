import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  withUser,
  parseJsonBody,
  requireInt,
  optionalString,
  notFound,
  unprocessable,
} from '@/lib/api-handler'

type Ctx = { params: { id: string } }

/** Same shape check as POST /workouts/templates. */
function parseTemplateExercises(value: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(value) || value.length === 0) {
    throw unprocessable('exercises must be a non-empty array')
  }
  if (value.length > 50) throw unprocessable('exercises must contain at most 50 entries')

  return value.map((raw, i) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw unprocessable(`exercises[${i}] must be an object`)
    }
    const ex = raw as Record<string, unknown>
    if (typeof ex.name !== 'string' || ex.name.trim() === '') {
      throw unprocessable(`exercises[${i}].name is required`)
    }

    const num = (field: string, fallback: number | null): number | null => {
      const v = ex[field]
      if (v === undefined || v === null || v === '') return fallback
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw unprocessable(`exercises[${i}].${field} must be a non-negative number`)
      }
      return v
    }

    return {
      name: ex.name.trim().slice(0, 100),
      defaultSets: num('defaultSets', 3) ?? 3,
      defaultReps: num('defaultReps', 10) ?? 10,
      defaultWeightKg: num('defaultWeightKg', null),
    }
  })
}

export const PUT = withUser<Ctx>(async (request, user, { params }) => {
  const id = requireInt(params.id, 'id')
  const body = await parseJsonBody(request)

  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, user_id: user.id },
  })
  if (!existing) throw notFound('Template not found')

  const name = optionalString(body.name, 'name', { maxLength: 100 })
  const exercises =
    body.exercises === undefined ? undefined : parseTemplateExercises(body.exercises)

  const updated = await prisma.workoutTemplate.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      exercises: exercises ?? (existing.exercises as Prisma.InputJsonValue),
    },
  })

  return NextResponse.json(updated)
})

export const DELETE = withUser<Ctx>(async (request, user, { params }) => {
  const id = requireInt(params.id, 'id')

  const existing = await prisma.workoutTemplate.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })
  if (!existing) throw notFound('Template not found')

  await prisma.workoutTemplate.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
})
