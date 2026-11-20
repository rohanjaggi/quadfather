import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withUser, optionalInt, optionalString } from '@/lib/api-handler'

// Leading-wildcard `ILIKE` scan, so not open to the internet (the caller sends initData);
// `?limit` must be sane or `take: NaN` would 500.
export const GET = withUser(async request => {
  const q = optionalString(request.nextUrl.searchParams.get('q'), 'q', { maxLength: 100 }) ?? ''
  const limit = optionalInt(request.nextUrl.searchParams.get('limit'), 'limit', {
    min: 1,
    max: 50,
  }) ?? 20

  const where: Prisma.ExerciseWhereInput = {}

  if (q.length >= 2) {
    where.name = { contains: q, mode: 'insensitive' }
  }

  const exercises = await prisma.exercise.findMany({
    where,
    take: limit,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(exercises)
})
