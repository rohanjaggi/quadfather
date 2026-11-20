'use client'

import { useEffect, useState } from 'react'
import { addToHomeScreen, checkHomeScreen } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'

const DISMISSED = 'qf.homeScreenOffer.dismissed'

function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISSED) === '1' } catch { return false }
}

/**
 * A one-time card offering Telegram's home-screen shortcut (Bot API 8.0), so
 * Quadfather opens like an app. Shown only when Telegram says the shortcut is
 * missing (or can't tell), and never again once added or dismissed.
 */
export default function HomeScreenOffer() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (wasDismissed()) return
    return checkHomeScreen(status => setShow(status === 'missed' || status === 'unknown'))
  }, [])

  if (!show) return null

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(DISMISSED, '1') } catch { /* private mode: it may show again */ }
  }

  return (
    <section className="card" aria-labelledby="home-screen-offer" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 id="home-screen-offer" className="card-title" style={{ margin: 0 }}>Add to your home screen</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>Opens straight into Quadfather, like any other app.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          className="btn-pill"
          data-active="true"
          // Retire the card on tap: iOS may never report "added", and an offer
          // that keeps coming back after the user said yes is worse than none.
          onClick={() => { dismiss(); addToHomeScreen(() => toast('Added to your home screen', { type: 'success' })) }}
        >
          Add
        </button>
        <button type="button" className="btn-ghost" onClick={dismiss} style={{ minHeight: 36, padding: '6px 10px', fontSize: 14 }}>
          Not now
        </button>
      </div>
    </section>
  )
}
