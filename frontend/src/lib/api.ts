import WebApp from '@twa-dev/sdk'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const initData = typeof window !== 'undefined' ? WebApp.initData : ''
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...options.headers,
    },
  })
}
