import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  const category = request.nextUrl.searchParams.get('category')
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10), 50)

  const where: Record<string, unknown> = {}

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
}
