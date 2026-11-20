'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import LogSheet from '@/components/LogSheet'
import { useHaptic } from '@/components/telegram'
import { FoodIcon, HomeIcon, PlusIcon, TrainingIcon, TrendsIcon } from '@/components/ui/icons'

// Settings is not a tab: it lives behind the avatar on Today.
const left = [
  { href: '/', label: 'Today', Icon: HomeIcon, match: ['/'] },
  // Water belongs to Food: reachable from Food and the Log sheet.
  { href: '/food', label: 'Food', Icon: FoodIcon, match: ['/food', '/water'] },
]
const right = [
  { href: '/workouts', label: 'Training', Icon: TrainingIcon, match: ['/workouts', '/running'] },
  { href: '/analytics', label: 'Trends', Icon: TrendsIcon, match: ['/analytics'] },
]

export default function BottomNav() {
  const pathname = usePathname()
  const haptic = useHaptic()
  const [logOpen, setLogOpen] = useState(false)
  const closeLog = useCallback(() => setLogOpen(false), [])

  // The evening "close the day" message's "I forgot something" button opens
  // the app at `/?sheet=log`: land straight on the Log sheet, then drop the flag.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('sheet') !== 'log') return
    setLogOpen(true)
    params.delete('sheet')
    const rest = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
  }, [])

  const tab = ({ href, label, Icon, match }: typeof left[number]) => {
    const active = match.some(m => (m === '/' ? pathname === '/' : pathname.startsWith(m)))
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          paddingTop: 7, textDecoration: 'none',
          fontSize: 12, fontWeight: 600,
          color: active ? 'var(--action)' : 'var(--muted)',
        }}
      >
        <span style={{
          display: 'grid', placeItems: 'center', width: 54, height: 30, borderRadius: 15,
          background: active ? 'var(--action-soft)' : 'transparent',
          transition: 'background-color .25s ease',
        }}>
          <Icon size={22} />
        </span>
        {label}
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Main"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
          display: 'grid', gridTemplateColumns: '1fr 1fr 76px 1fr 1fr', alignItems: 'start',
          height: 'calc(68px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(251, 248, 244, 0.94)',
          backdropFilter: 'saturate(1.4) blur(18px)',
          WebkitBackdropFilter: 'saturate(1.4) blur(18px)',
          borderTop: '1px solid var(--line)',
        }}
      >
        {left.map(tab)}
        <div style={{ display: 'grid', placeItems: 'center', paddingTop: 6 }}>
          <button
            type="button"
            aria-label="Log"
            aria-haspopup="dialog"
            aria-expanded={logOpen}
            onClick={() => { haptic.impact('light'); setLogOpen(true) }}
            style={{
              width: 54, height: 54, borderRadius: 27, border: 'none',
              background: 'var(--action)', color: 'var(--action-ink)',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 6px 16px -6px rgba(47, 107, 79, 0.6)',
            }}
          >
            <PlusIcon size={26} strokeWidth={2.2} />
          </button>
        </div>
        {right.map(tab)}
      </nav>
      <LogSheet open={logOpen} onClose={closeLog} />
    </>
  )
}
