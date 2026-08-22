import { NextResponse } from 'next/server'
import { getUserAICredentials } from '@/lib/auth'
import { parseWorkoutText } from '@/lib/ai'
import { withUser, parseJsonBody, requireString } from '@/lib/api-handler'

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request)
  const text = requireString(body.text, 'text', { maxLength: 4000 })

  const { provider, apiKey, model } = getUserAICredentials(user)
  const result = await parseWorkoutText(provider, apiKey, model, text)

  return NextResponse.json(result)
})
