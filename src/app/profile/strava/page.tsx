'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
// Same import style as `@/lib/api` (already in this page's module graph); every
// use is guarded by a `typeof window` check because the SDK is browser-only.
import { useUser } from '@/context/UserContext'
import { getStravaConnectUrl, disconnectStrava } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import SummaryCard from '@/components/dashboard/SummaryCard'

const SCOPE_NOTICE = "Strava is connected without activity access — reconnect and allow 'View data about your activities'"

/**
 * Navigate the Mini App webview itself to the Strava OAuth page. We deliberately
 * do NOT use `WebApp.openLink` here: that opens Telegram's external browser, and
 * the OAuth callback redirects back to `/profile/strava` on this origin — outside
 * the Mini App there is no initData, so the user would land on the auth-gate
 * screen. In-webview navigation round-trips fine because the Telegram SDK
 * restores its init params from sessionStorage on return.
 */
function openExternal(url: string) {
  if (typeof window === 'undefined') return
  window.location.href = url
}

// useSearchParams needs a Suspense boundary in Next 14 for statically rendered pages.
export default function StravaSettingsPage() {
  return (
    <Suspense fallback={null}>
      <StravaSettings />
    </Suspense>
  )
}

function StravaSettings() {
  const { user, refreshUser } = useUser()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const connected = !!user?.strava_connected

  const errorParam = searchParams.get('error')
  const successParam = searchParams.get('success')

  // The tokens are stored even when Strava grants a scope without activity
  // access, so this is a persistent state — not just a one-time callback banner.
  const scopeMissing = connected && user?.strava_scope_ok === false
  const showScopeNotice = scopeMissing || errorParam === 'insufficient_scope'

  const callbackNotice: { text: string; tone: 'error' | 'success' } | null = showScopeNotice
    ? { text: SCOPE_NOTICE, tone: 'error' }
    : errorParam
      ? { text: "Couldn't connect to Strava. Please try again.", tone: 'error' }
      : successParam
        ? { text: 'Connected', tone: 'success' }
        : null

  // Returning from the OAuth callback — pull the fresh connection state.
  useEffect(() => {
    if (errorParam || successParam) {
      refreshUser().catch(err => console.error('Failed to refresh user after Strava callback:', err))
    }
  }, [errorParam, successParam, refreshUser])

  async function handleConnect() {
    setLoading(true)
    setActionError(null)
    try {
      const { url } = await getStravaConnectUrl()
      openExternal(url)
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to start Strava connection'))
    } finally {
      // The webview may defer or block the navigation; leaving the button stuck
      // on "Connecting…" would give the user nothing to retry with.
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setActionError(null)
    try {
      await disconnectStrava()
      await refreshUser()
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to disconnect Strava'))
    } finally {
      setLoading(false)
    }
  }

  const lastSynced = user?.strava_last_synced_at
    ? new Date(user.strava_last_synced_at).toLocaleString()
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="fade-up">
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '11px',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '5px',
        }}>
          Integration
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '36px',
          fontWeight: 400, lineHeight: 1.1, color: 'var(--tg-theme-text-color)',
        }}>
          Strava
        </h1>
      </div>

      {callbackNotice && (
        <div className="fade-up" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px',
          fontFamily: 'var(--font-display)', fontSize: '12px',
          padding: '10px 14px', borderRadius: '10px', lineHeight: 1.5,
          color: callbackNotice.tone === 'success' ? 'oklch(0.35 0.04 155)' : 'var(--accent-calories)',
          backgroundColor: callbackNotice.tone === 'success' ? 'oklch(0.92 0.02 155)' : 'oklch(0.94 0.02 30)',
        }}>
          <span>{callbackNotice.text}</span>
          {showScopeNotice && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleConnect}
              disabled={loading}
              style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--accent-calories)' }}
            >
              {loading ? 'Opening Strava…' : 'Reconnect with Strava'}
            </button>
          )}
        </div>
      )}

      {actionError && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          color: 'var(--accent-calories)', padding: '10px 14px',
          backgroundColor: 'oklch(0.94 0.02 30)', borderRadius: '10px',
        }}>
          {actionError}
        </p>
      )}

      <div className="fade-up fade-up-1">
        <SummaryCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '12px',
                backgroundColor: connected ? '#FC4C021A' : 'var(--tg-theme-bg-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={connected ? '#FC4C02' : 'var(--tg-theme-hint-color)'}
                  strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              </div>
              <div>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '17px',
                  fontWeight: 500, color: 'var(--tg-theme-text-color)',
                }}>
                  {connected ? 'Connected' : 'Not Connected'}
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: '12px',
                  color: 'var(--tg-theme-hint-color)',
                }}>
                  {connected
                    ? `Runs sync when you open the Running page${lastSynced ? ` · Last: ${lastSynced}` : ''}`
                    : 'Connect to import your runs'}
                </p>
              </div>
            </div>

            {connected ? (
              <button
                className="btn-secondary"
                onClick={handleDisconnect}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? 'Disconnecting...' : 'Disconnect Strava'}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={loading}
                style={{
                  width: '100%', padding: '14px', borderRadius: '14px',
                  border: 'none', backgroundColor: '#FC4C02', color: 'white',
                  fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', transition: 'opacity 0.2s',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Connecting...' : 'Connect with Strava'}
              </button>
            )}
          </div>
        </SummaryCard>
      </div>

      <div className="fade-up fade-up-2">
        <SummaryCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '12px',
              color: 'var(--tg-theme-hint-color)', lineHeight: 1.5,
            }}>
              Connecting Strava allows Quadfather to import your running activities.
              Calories from your runs can be added to your daily allowance.
            </p>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '12px',
              color: 'var(--tg-theme-hint-color)', lineHeight: 1.5,
            }}>
              We only read your activity data — we never post or modify anything on your Strava account.
            </p>
          </div>
        </SummaryCard>
      </div>
    </div>
  )
}
