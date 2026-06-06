import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(request)
    const id = parseInt(params.id, 10)
    const body = await request.json()

    const existing = await prisma.workoutTemplate.findFirst({
      where: { id, user_id: user.id },
    })
    if (!existing) {
      return NextResponse.json({ detail: 'Template not found' }, { status: 404 })
    }

    const updated = await prisma.workoutTemplate.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        exercises: body.exercises ?? existing.exercises,
      },
    })

    return NextResponse.json(updated)
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

    const existing = await prisma.workoutTemplate.findFirst({
      where: { id, user_id: user.id },
    })
    if (!existing) {
      return NextResponse.json({ detail: 'Template not found' }, { status: 404 })
    }

    await prisma.workoutTemplate.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
