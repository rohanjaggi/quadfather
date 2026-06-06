import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)

    const templates = await prisma.workoutTemplate.findMany({
      where: { user_id: user.id },
      orderBy: { updated_at: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { name, exercises } = body

    if (!name || !Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json(
        { detail: 'name and exercises (non-empty array) are required' },
        { status: 422 },
      )
    }

    const template = await prisma.workoutTemplate.create({
      data: {
        user_id: user.id,
        name,
        exercises,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
