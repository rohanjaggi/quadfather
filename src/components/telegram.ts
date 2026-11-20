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

// ---- Bot API 8.0 bridge -------------------------------------------------
// The bundled @twa-dev/sdk (7.10) predates full-screen and home-screen
// shortcuts, so these talk to Telegram's raw event bridge, which the bundled
// script does expose. Everything is gated on the client's reported version.
// shortcut: raw events instead of SDK methods; switch to WebApp.requestFullscreen /
// addToHomeScreen once @twa-dev/sdk is upgraded to 8.x.

type Insets = { top?: number; bottom?: number; left?: number; right?: number }
type TgEventHandler = (event: string, data: unknown) => void
interface TgWindow {
  Telegram?: {
    WebApp?: { initData?: string; platform?: string; isVersionAtLeast?: (v: string) => boolean }
    WebView?: {
      postEvent: (event: string, callback?: () => void, data?: unknown) => void
      onEvent: (event: string, cb: TgEventHandler) => void
      offEvent: (event: string, cb: TgEventHandler) => void
    }
  }
}

const tg = () => (typeof window === 'undefined' ? undefined : (window as unknown as TgWindow).Telegram)

/** True inside a real Telegram session whose client supports Bot API `v`. */
export function tgSupports(v: string): boolean {
  const t = tg()
  try { return !!t?.WebApp?.initData && !!t.WebApp.isVersionAtLeast?.(v) && !!t.WebView } catch { return false }
}

export function tgPost(event: string, data?: unknown) {
  try { tg()?.WebView?.postEvent(event, undefined, data) } catch { /* older client */ }
}

/** Subscribes to a raw Telegram event; returns the unsubscribe. */
export function tgOn(event: string, cb: (data: unknown) => void): () => void {
  const view = tg()?.WebView
  if (!view) return () => {}
  const handler: TgEventHandler = (_e, data) => cb(data)
  view.onEvent(event, handler)
  return () => { try { view.offEvent(event, handler) } catch { /* ignore */ } }
}

/**
 * Full screen (Bot API 8.0): the app takes the whole screen and Telegram floats
 * its own buttons over the top, so the device and Telegram safe areas are
 * published as CSS variables (--tg-safe-top, --tg-content-top) that the layout
 * pads by. Returns the cleanup.
 */
export function enterFullscreen(): () => void {
  // Phones only: on Telegram Desktop/macOS this would blow the window up.
  const platform = tg()?.WebApp?.platform ?? ''
  if (!tgSupports('8.0') || !/^(ios|android)/.test(platform)) return () => {}
  const root = document.documentElement
  const set = (name: string) => (data: unknown) => {
    const top = Number((data as Insets | undefined)?.top ?? 0)
    root.style.setProperty(name, `${Number.isFinite(top) ? top : 0}px`)
  }
  const offs = [
    tgOn('safe_area_changed', set('--tg-safe-top')),
    tgOn('content_safe_area_changed', set('--tg-content-top')),
  ]
  tgPost('web_app_request_safe_area')
  tgPost('web_app_request_content_safe_area')
  tgPost('web_app_request_fullscreen')
  return () => offs.forEach(off => off())
}

export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed'

/** Asks Telegram whether the home-screen shortcut exists. */
export function checkHomeScreen(cb: (status: HomeScreenStatus) => void): () => void {
  if (!tgSupports('8.0')) { cb('unsupported'); return () => {} }
  const off = tgOn('home_screen_checked', data => {
    cb(((data as { status?: HomeScreenStatus } | undefined)?.status) ?? 'unknown')
  })
  tgPost('web_app_check_home_screen')
  return off
}

/** Opens Telegram's "add to home screen" prompt; `onAdded` fires on success. */
export function addToHomeScreen(onAdded: () => void): () => void {
  const off = tgOn('home_screen_added', () => { off(); onAdded() })
  tgPost('web_app_add_to_home_screen')
  return off
}
