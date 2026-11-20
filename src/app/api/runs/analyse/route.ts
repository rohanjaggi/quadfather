import { NextResponse } from 'next/server'
import { getUserAICredentials } from '@/lib/auth'
import { analyseRunScreenshot } from '@/lib/ai'
import { callAIProvider, readImageUpload, withUser } from '@/lib/api-handler'

export const POST = withUser(async (request, user) => {
  const ai = getUserAICredentials(user)

  const { image } = await readImageUpload(request)

  // Provider SDK errors carry the API key and prompt fragments in `.message`;
  // without this they fell through to the generic 500 "Internal error", which
  // told the user nothing about the real cause (a bad key).
  const result = await callAIProvider('runs/analyse', () =>
    analyseRunScreenshot(ai, image),
  )
  return NextResponse.json(result)
})
