import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getUserAICredentials } from '@/lib/auth'
import { parseWorkoutText } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { text } = body
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { detail: 'text is required' },
        { status: 422 },
      )
    }

    const { provider, apiKey, model } = getUserAICredentials(user)
    const result = await parseWorkoutText(provider, apiKey, model, text)

    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    if (message.includes('No API key')) {
      return NextResponse.json({ detail: message }, { status: 400 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
