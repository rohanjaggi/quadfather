'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@/context/UserContext'
import { syncStravaRuns } from '@/lib/api'
import { errorMessage, errorStatus } from '@/lib/errors'

export default function StravaSync() {
  const { user, refresh, refreshUser } = useUser()
  const [syncing, setSyncing] = useState(false)
  const [autoSynced, setAutoSynced] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)

  // `syncing` is state, so the guard that used to read it saw a stale `false`
  // for anything captured in the same tick — StrictMode's double mount fired
  // two syncs in dev, and a double tap fired two in production. A ref updates
  // synchronously, so the second caller actually sees the first.
  const syncingRef = useRef(false)

  const doSync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    setSyncError(null)
    setNeedsReconnect(false)
    try {
      const result = await syncStravaRuns()
      setLastSyncedAt(result.last_synced_at)
      await refresh()
      // Keeps "Last synced" on the settings page in step. A failure here is a
      // stale label, not a failed sync, so it must not set `syncError`.
      try {
        await refreshUser()
      } catch (e) {
        console.error('Failed to refresh user after Strava sync:', e)
      }
    } catch (e) {
      console.error('Strava sync failed:', e)
      // 409 = tokens stored, but the granted scope has no activity read.
      setNeedsReconnect(errorStatus(e) === 409)
      setSyncError(errorMessage(e, 'Strava sync failed'))
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [refresh, refreshUser])

  useEffect(() => {
    if (user?.strava_connected && !autoSynced) {
      setAutoSynced(true)
      doSync()
    }
  }, [user?.strava_connected, autoSynced, doSync])

  if (!user?.strava_connected) return null

  const syncTime = lastSyncedAt ?? user.strava_last_synced_at
  const lastSynced = syncTime
    ? formatRelativeTime(new Date(syncTime))
    : 'Never'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
          aria-label={syncing ? 'Syncing Strava runs' : 'Sync Strava runs'}
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

      {syncError && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '11px', lineHeight: 1.4,
          color: 'var(--accent-calories)', padding: '0 4px',
        }}>
          {syncError}
          {needsReconnect && ' — Reconnect Strava in Settings → Strava'}
        </p>
      )}
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
