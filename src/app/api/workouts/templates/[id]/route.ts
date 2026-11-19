import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, requireInt, notFound } from '@/lib/api-handler'

type Ctx = { params: { id: string } }

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
