import { NextResponse } from 'next/server'
import { getUserAICredentials } from '@/lib/auth'
import { analyseRunScreenshot } from '@/lib/ai'
import {
  ApiError,
  badRequest,
  callAIProvider,
  unprocessable,
  withUser,
} from '@/lib/api-handler'

/**
 * Formats every provider actually accepts. Anthropic/OpenAI reject HEIC, BMP,
 * TIFF and friends with a generic 422 of their own, so catch them here where
 * we can say what went wrong. (Same list as `foods/analyse`.)
 */
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
/** Vercel's body limit is 4.5 MB on the hobby tier; cap well before the SDKs do. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export const POST = withUser(async (request, user) => {
  const { provider, apiKey, model } = getUserAICredentials(user)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw badRequest('Malformed multipart form data')
  }

  const image = formData.get('image')
  if (!image || typeof image === 'string') {
    throw unprocessable('An image file is required')
  }
  if (!ALLOWED_MIME.includes(image.type)) {
    throw unprocessable('Image must be a JPEG, PNG, WebP or GIF')
  }
  if (image.size > MAX_IMAGE_BYTES) {
    throw new ApiError(413, 'Image must be smaller than 8 MB')
  }

  const base64 = Buffer.from(await image.arrayBuffer()).toString('base64')

  // Provider SDK errors carry the API key and prompt fragments in `.message`;
  // without this they fell through to the generic 500 "Internal error", which
  // told the user nothing about the real cause (a bad key).
  const result = await callAIProvider('runs/analyse', () =>
    analyseRunScreenshot(provider, apiKey, model, base64, image.type),
  )
  return NextResponse.json(result)
})
