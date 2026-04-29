'use client'

import Link from 'next/link'
import { useUser } from '@/context/UserContext'

export default function StravaStatus() {
  const { user } = useUser()
  const connected = !!user?.strava_connected

  return (
    <Link
      href="/profile/strava"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '99px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        textDecoration: 'none',
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        backgroundColor: connected ? '#4CAF50' : 'var(--tg-theme-hint-color)',
      }} />
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        fontWeight: 500,
        color: connected ? 'var(--tg-theme-text-color)' : 'var(--tg-theme-hint-color)',
      }}>
        {connected ? 'Synced' : 'Connect Strava'}
      </span>
    </Link>
  )
}
