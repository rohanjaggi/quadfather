import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withUser, optionalInt, optionalString } from '@/lib/api-handler'

// The catalog is shared rather than per-user, but the lookup still runs a
// leading-wildcard `ILIKE` scan, so it is not something to leave open to the
// internet — the only caller (`searchExercises`) already sends initData.
// The query string also has to be sane: `?limit=abc` used to reach Prisma as
// `take: NaN` and 500.
export const GET = withUser(async request => {
  const q = optionalString(request.nextUrl.searchParams.get('q'), 'q', { maxLength: 100 }) ?? ''
  const category = optionalString(request.nextUrl.searchParams.get('category'), 'category', {
    maxLength: 50,
  })
  const limit = optionalInt(request.nextUrl.searchParams.get('limit'), 'limit', {
    min: 1,
    max: 50,
  }) ?? 20

  const where: Prisma.ExerciseWhereInput = {}

  if (q.length >= 2) {
    where.name = { contains: q, mode: 'insensitive' }
  }
  if (category) {
    where.category = category
  }

  const exercises = await prisma.exercise.findMany({
    where,
    take: limit,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(exercises)
})
