'use client'

import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

export default function TelegramProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    WebApp.ready()
    WebApp.expand()
  }, [])

  return <>{children}</>
}
