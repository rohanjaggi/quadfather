import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser } from '@/lib/api-handler'

export const GET = withUser(async (request, user) => {
  if (!user.access_token) {
    return NextResponse.json({ has_token: false, hint: null })
  }
  return NextResponse.json({
    has_token: true,
    hint: '••••' + user.access_token.slice(-6),
  })
})

export const POST = withUser(async (request, user) => {
  const token = crypto.randomBytes(32).toString('hex')

  await prisma.user.update({
    where: { id: user.id },
    data: { access_token: token },
  })

  return NextResponse.json({ token })
})

export const DELETE = withUser(async (request, user) => {
  await prisma.user.update({
    where: { id: user.id },
    data: { access_token: null },
  })

  return new NextResponse(null, { status: 204 })
})
