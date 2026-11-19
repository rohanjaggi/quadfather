'use client'

// The Telegram hooks, deliberately in their own module: `@twa-dev/sdk` touches
// `window` at import time, so anything a page imports during prerender must not
// pull it in. `TelegramProvider` (client-only, loaded with ssr:false) owns the
// SDK and fills these contexts.
import { createContext, useContext } from 'react'

export interface HapticAPI {
  impact: (style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notification: (type?: 'success' | 'warning' | 'error') => void
  selection: () => void
}

export const HapticContext = createContext<HapticAPI>({
  impact: () => {},
  notification: () => {},
  selection: () => {},
})

export function useHaptic(): HapticAPI {
  return useContext(HapticContext)
}

export interface BackAPI {
  available: boolean
  /** Shows Telegram's back button wired to `onBack`; returns the cleanup. */
  attach: (onBack: () => void) => () => void
}

export const BackContext = createContext<BackAPI>({ available: false, attach: () => () => {} })

export function useTelegramBack(): BackAPI {
  return useContext(BackContext)
}
