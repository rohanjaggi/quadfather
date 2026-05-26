import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getUserAICredentials } from '@/lib/auth'
import { analyseRunScreenshot } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { provider, apiKey, model } = getUserAICredentials(user)

    const formData = await request.formData()
    const image = formData.get('image') as File | null
    if (!image) {
      return NextResponse.json({ detail: 'Image is required' }, { status: 422 })
    }

    const buffer = Buffer.from(await image.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mimeType = image.type || 'image/jpeg'

    const result = await analyseRunScreenshot(provider, apiKey, model, base64, mimeType)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('No API key configured') || message === 'No AI key configured') {
      return NextResponse.json({ detail: message }, { status: 403 })
    }
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
