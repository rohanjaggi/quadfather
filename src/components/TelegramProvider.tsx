'use client'

import { useEffect, useMemo } from 'react'
import WebApp from '@twa-dev/sdk'
import { BackContext, HapticContext, type BackAPI, type HapticAPI } from '@/components/telegram'

/**
 * The app's own background, hard-coded in `globals.css` (`body` background-color
 * and the `--tg-theme-bg-color` override). Telegram's native header and the area
 * behind the webview are painted by the client, not by CSS, so they have to be
 * told this value explicitly or a dark-theme client frames a light app in black.
 */
const APP_BG_COLOR = '#F3EEE8'

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

  // Native back button (Bot API 6.1). Only offered inside a real Telegram
  // session (initData present); elsewhere pages fall back to an in-page link.
  // A stack, so the top-most layer wins: with a sheet open over a subpage,
  // back closes the sheet first, then leaves the page.
  const back = useMemo<BackAPI>(() => {
    const available = typeof window !== 'undefined' && !!WebApp.initData
      && typeof WebApp.isVersionAtLeast === 'function' && WebApp.isVersionAtLeast('6.1')
    const stack: (() => void)[] = []
    const dispatch = () => stack[stack.length - 1]?.()
    if (available) tryWebAppCall(() => WebApp.BackButton.onClick(dispatch))
    return {
      available,
      attach: (onBack) => {
        if (!available) return () => {}
        stack.push(onBack)
        tryWebAppCall(() => WebApp.BackButton.show())
        return () => {
          const i = stack.lastIndexOf(onBack)
          if (i >= 0) stack.splice(i, 1)
          if (stack.length === 0) tryWebAppCall(() => WebApp.BackButton.hide())
        }
      },
    }
  }, [])

  return (
    <HapticContext.Provider value={haptic}>
      <BackContext.Provider value={back}>
        {children}
      </BackContext.Provider>
    </HapticContext.Provider>
  )
}
