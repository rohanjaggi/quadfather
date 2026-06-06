import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, getAuthenticatedUserFlexible } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFlexible(request)
    const body = await request.json()

    const { steps, date } = body

    if (typeof steps !== 'number' || steps < 0) {
      return NextResponse.json(
        { detail: 'steps must be a non-negative number' },
        { status: 422 },
      )
    }

    const targetDate = date ? new Date(date) : new Date()
    targetDate.setUTCHours(0, 0, 0, 0)

    const stepLog = await prisma.stepLog.upsert({
      where: {
        user_id_date: { user_id: user.id, date: targetDate },
      },
      update: { steps: Math.round(steps), logged_at: new Date() },
      create: {
        user_id: user.id,
        steps: Math.round(steps),
        date: targetDate,
        source: 'shortcut',
      },
    })

    return NextResponse.json(stepLog, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message === 'User not found') {
      return NextResponse.json({ detail: message }, { status: 404 })
    }
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const days = parseInt(request.nextUrl.searchParams.get('days') ?? '7', 10)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setUTCHours(0, 0, 0, 0)

    const stepLogs = await prisma.stepLog.findMany({
      where: {
        user_id: user.id,
        date: { gte: startDate },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(stepLogs)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
