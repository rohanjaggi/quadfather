import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { getStravaAuthUrl, signStravaState } from '@/lib/strava'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const state = signStravaState(`${user.telegram_id}`)
    const url = getStravaAuthUrl(state)
    return NextResponse.json({ url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
