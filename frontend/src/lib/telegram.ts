import WebApp from '@twa-dev/sdk'

export { WebApp }

export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export function isTelegram(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null
  return (window.Telegram?.WebApp?.initDataUnsafe?.user as TelegramUser) ?? null
}
