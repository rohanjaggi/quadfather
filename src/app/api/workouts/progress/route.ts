import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getExerciseProgress } from '@/lib/progress'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const exerciseName = request.nextUrl.searchParams.get('exercise_name')

    if (!exerciseName) {
      return NextResponse.json({ detail: 'exercise_name is required' }, { status: 422 })
    }

    const progress = await getExerciseProgress(user.id, exerciseName, user.training_focus ?? null)

    return NextResponse.json(progress)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
