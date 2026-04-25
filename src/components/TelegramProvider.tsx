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

export default function TelegramProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    WebApp.ready()
    WebApp.expand()
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
