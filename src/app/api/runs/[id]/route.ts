import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request)
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) {
      return NextResponse.json({ detail: 'Invalid run ID' }, { status: 400 })
    }
    const body = await request.json()

    if (typeof body.added_to_allowance !== 'boolean') {
      return NextResponse.json({ detail: 'added_to_allowance must be a boolean' }, { status: 422 })
    }

    const run = await prisma.runLog.findFirst({
      where: { id: numId, user_id: user.id },
    })
    if (!run) {
      return NextResponse.json({ detail: 'Run not found' }, { status: 404 })
    }

    const updated = await prisma.runLog.update({
      where: { id: run.id },
      data: { added_to_allowance: body.added_to_allowance },
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request)
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) {
      return NextResponse.json({ detail: 'Invalid run ID' }, { status: 400 })
    }

    const run = await prisma.runLog.findFirst({
      where: { id: numId, user_id: user.id },
    })
    if (!run) {
      return NextResponse.json({ detail: 'Run not found' }, { status: 404 })
    }

    await prisma.runLog.delete({ where: { id: run.id } })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
