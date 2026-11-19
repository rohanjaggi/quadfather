'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@/context/UserContext'
import { syncStravaRuns } from '@/lib/api'
import { errorMessage, errorStatus } from '@/lib/errors'

export type StravaSyncResult = Awaited<ReturnType<typeof syncStravaRuns>>

export interface StravaState {
  connected: boolean
  syncing: boolean
  /** "5m ago", "just now", or null when it has never synced. */
  lastSynced: string | null
  error: string | null
  /** Tokens stored, but the granted scope has no activity read (409). */
  needsReconnect: boolean
  /** Resolves to the sync result, or null when it failed or one was already running. */
  sync: () => Promise<StravaSyncResult | null>
}

/**
 * Strava sync state for the Runs page: syncs once on mount when connected,
 * and exposes `sync` for the log sheet's "Sync from Strava" row. Call it once
 * per page so the auto-sync only fires once.
 */
export function useStravaSync(): StravaState {
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

  const sync = useCallback(async (): Promise<StravaSyncResult | null> => {
    if (syncingRef.current) return null
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
      return result
    } catch (e) {
      console.error('Strava sync failed:', e)
      // 409 = tokens stored, but the granted scope has no activity read.
      setNeedsReconnect(errorStatus(e) === 409)
      setSyncError(errorMessage(e, "Couldn't sync Strava. Try again in a moment."))
      return null
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [refresh, refreshUser])

  useEffect(() => {
    if (user?.strava_connected && !autoSynced) {
      setAutoSynced(true)
      sync()
    }
  }, [user?.strava_connected, autoSynced, sync])

  const syncTime = lastSyncedAt ?? user?.strava_last_synced_at ?? null

  return {
    connected: !!user?.strava_connected,
    syncing,
    lastSynced: syncTime ? formatRelativeTime(new Date(syncTime)) : null,
    error: syncError,
    needsReconnect,
    sync,
  }
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
