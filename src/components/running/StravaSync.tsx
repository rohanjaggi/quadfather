'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@/context/UserContext'
import { syncStravaRuns } from '@/lib/api'

export default function StravaSync() {
  const { user, refresh } = useUser()
  const [syncing, setSyncing] = useState(false)
  const [autoSynced, setAutoSynced] = useState(false)

  const doSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await syncStravaRuns()
      await refresh()
    } catch (e) {
      console.error('Strava sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }, [syncing, refresh])

  useEffect(() => {
    if (user?.strava_connected && !autoSynced) {
      setAutoSynced(true)
      doSync()
    }
  }, [user?.strava_connected, autoSynced, doSync])

  if (!user?.strava_connected) return null

  const lastSynced = user.strava_last_synced_at
    ? formatRelativeTime(new Date(user.strava_last_synced_at))
    : 'Never'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: '12px',
      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: '#FC4C02',
        }} />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          color: 'var(--tg-theme-hint-color)',
        }}>
          {syncing ? 'Syncing...' : `Synced ${lastSynced}`}
        </span>
      </div>
      <button
        onClick={doSync}
        disabled={syncing}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: '8px',
          border: 'none', backgroundColor: 'transparent',
          color: 'var(--tg-theme-hint-color)', cursor: 'pointer',
          opacity: syncing ? 0.5 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
      </button>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}
