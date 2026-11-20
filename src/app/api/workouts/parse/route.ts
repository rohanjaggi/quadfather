import { NextResponse } from 'next/server'
import { getUserAICredentials } from '@/lib/auth'
import { parseWorkoutText } from '@/lib/ai'
import { withUser, parseJsonBody, requireString, callAIProvider } from '@/lib/api-handler'

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request)
  const text = requireString(body.text, 'text', { maxLength: 4000 })

  const ai = getUserAICredentials(user)
  const result = await callAIProvider('workouts/parse', () =>
    parseWorkoutText(ai, text),
  )

  return NextResponse.json(result)
})
