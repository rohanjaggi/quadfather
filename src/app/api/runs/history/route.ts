import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    const daysParam = request.nextUrl.searchParams.get('days') ?? '30'
    const days = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 90)

    const startDate = new Date()
    startDate.setUTCDate(startDate.getUTCDate() - days)
    startDate.setUTCHours(0, 0, 0, 0)

    const runs = await prisma.runLog.findMany({
      where: {
        user_id: user.id,
        run_date: { gte: startDate },
      },
      orderBy: { run_date: 'desc' },
    })

    return NextResponse.json(runs)
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
