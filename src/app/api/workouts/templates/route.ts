import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withUser, parseJsonBody, requireString, unprocessable } from '@/lib/api-handler'

/**
 * A template exercise as the app writes it (`TemplateExercise` in
 * `src/types/workouts.ts`). Validated here so the JSON column can be trusted by
 * every reader instead of being whatever the client posted.
 */
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
    const name = requireString(ex.name, `exercises[${i}].name`, { maxLength: 100 })

    const num = (field: string, fallback: number | null): number | null => {
      const v = ex[field]
      if (v === undefined || v === null || v === '') return fallback
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw unprocessable(`exercises[${i}].${field} must be a non-negative number`)
      }
      return v
    }

    return {
      name,
      defaultSets: num('defaultSets', 3) ?? 3,
      defaultReps: num('defaultReps', 10) ?? 10,
      defaultWeightKg: num('defaultWeightKg', null),
    }
  })
}

export const GET = withUser(async (request, user) => {
  const templates = await prisma.workoutTemplate.findMany({
    where: { user_id: user.id },
    orderBy: { updated_at: 'desc' },
  })

  return NextResponse.json(templates)
})

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request)

  const name = requireString(body.name, 'name', { maxLength: 100 })
  const exercises = parseTemplateExercises(body.exercises)

  const template = await prisma.workoutTemplate.create({
    data: { user_id: user.id, name, exercises },
  })

  return NextResponse.json(template, { status: 201 })
})
