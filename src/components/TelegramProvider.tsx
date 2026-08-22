'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import WebApp from '@twa-dev/sdk'

interface HapticAPI {
  impact: (style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notification: (type?: 'success' | 'warning' | 'error') => void
  selection: () => void
}

const HapticContext = createContext<HapticAPI>({
  impact: () => {},
  notification: () => {},
  selection: () => {},
})

export function useHaptic(): HapticAPI {
  return useContext(HapticContext)
}

/**
 * The app's own background, hard-coded in `globals.css` (`body` background-color
 * and the `--tg-theme-bg-color` override). Telegram's native header and the area
 * behind the webview are painted by the client, not by CSS, so they have to be
 * told this value explicitly or a dark-theme client frames a light app in black.
 */
const APP_BG_COLOR = '#F5F2EF'

/**
 * Calls one optional Telegram method. Every one of these landed in a specific
 * Bot API version (6.1/6.9/7.7), and the SDK simply doesn't define the property
 * on older clients — and *does* throw `WebAppMethodUnsupported` when the client
 * predates the method — so both the existence check and the try/catch matter.
 */
function tryWebAppCall(run: () => void) {
  try {
    run()
  } catch {
    // Older Telegram client: the app just keeps the client's defaults.
  }
}

export default function TelegramProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    WebApp.ready()
    WebApp.expand()

    // Match the native chrome to the palette the app forces in `globals.css`.
    if (typeof WebApp.setHeaderColor === 'function') {
      tryWebAppCall(() => WebApp.setHeaderColor(APP_BG_COLOR))
    }
    if (typeof WebApp.setBackgroundColor === 'function') {
      tryWebAppCall(() => WebApp.setBackgroundColor(APP_BG_COLOR))
    }
    // Bot API 7.7. Without it a vertical drag inside a scrolled list is read as
    // a dismiss gesture and collapses the Mini App mid-scroll.
    if (typeof WebApp.disableVerticalSwipes === 'function') {
      tryWebAppCall(() => WebApp.disableVerticalSwipes())
    }
  }, [])

  const haptic = useMemo<HapticAPI>(() => {
    const hf = typeof window !== 'undefined' ? WebApp.HapticFeedback : null
    return {
      impact: (style = 'light') => { try { hf?.impactOccurred(style) } catch {} },
      notification: (type = 'success') => { try { hf?.notificationOccurred(type) } catch {} },
      selection: () => { try { hf?.selectionChanged() } catch {} },
    }
  }, [])

  return (
    <HapticContext.Provider value={haptic}>
      {children}
    </HapticContext.Provider>
  )
}
