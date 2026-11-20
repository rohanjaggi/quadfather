'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@/context/UserContext'
import { getStravaConnectUrl, disconnectStrava } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import PageHeader from '@/components/ui/PageHeader'
import { toast } from '@/components/ui/Toast'
import { ConfirmSheet, FormError } from '@/components/settings/ui'

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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const connected = !!user?.strava_connected

  const errorParam = searchParams.get('error')
  const successParam = searchParams.get('success')

  // The tokens are stored even when Strava grants a scope without activity
  // access, so this is a persistent state — not just a one-time callback banner.
  const scopeMissing = connected && user?.strava_scope_ok === false
  const showScopeNotice = scopeMissing || errorParam === 'insufficient_scope'
  const callbackError = !showScopeNotice && errorParam ? "Couldn't connect to Strava. Try again." : null

  // Returning from the OAuth callback — pull the fresh connection state.
  useEffect(() => {
    if (errorParam || successParam) {
      refreshUser().catch(err => console.error('Failed to refresh user after Strava callback:', err))
    }
    if (successParam && !errorParam) toast('Strava connected', { type: 'success' })
  }, [errorParam, successParam, refreshUser])

  async function handleConnect() {
    setLoading(true)
    setActionError(null)
    try {
      const { url } = await getStravaConnectUrl()
      openExternal(url)
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't open Strava. Try again."))
    } finally {
      // The webview may defer or block the navigation; leaving the button stuck
      // on "Opening Strava…" would give the user nothing to retry with.
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    setActionError(null)
    try {
      await disconnectStrava()
      await refreshUser()
      setConfirmOpen(false)
      toast('Strava disconnected', { type: 'success' })
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't disconnect Strava. Try again."))
    } finally {
      setLoading(false)
    }
  }

  const lastSynced = user?.strava_last_synced_at
    ? new Date(user.strava_last_synced_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null

  const headline = showScopeNotice
    ? 'Connected without run access'
    : connected ? 'Connected' : 'Not connected'
  const detail = showScopeNotice
    ? 'Reconnect and allow “View data about your activities” so your runs can come in.'
    : connected
      ? `New runs come in when you open your runs.${lastSynced ? ` Last synced ${lastSynced}.` : ''}`
      : 'Connect to bring your runs in from Strava.'

  return (
    <div>
      <PageHeader title="Strava" back={{ href: '/profile', label: 'Settings' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>{headline}</h2>
          <p style={{ margin: '4px 0 16px', fontSize: 15, color: 'var(--muted)' }}>{detail}</p>

          {(callbackError || (actionError && !confirmOpen)) && (
            <div style={{ marginBottom: 12 }}>
              <FormError>{actionError ?? callbackError}</FormError>
            </div>
          )}

          {connected && !showScopeNotice ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setActionError(null); setConfirmOpen(true) }}
              disabled={loading}
              style={{ width: '100%', color: 'var(--over)' }}
            >
              Disconnect Strava
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleConnect} disabled={loading}>
              {loading ? 'Opening Strava…' : showScopeNotice ? 'Reconnect Strava' : 'Connect Strava'}
            </button>
          )}
        </section>

        <section className="card">
          <h2 className="card-title" style={{ margin: '0 0 6px' }}>What Quadfather reads</h2>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
            Your runs, so they show up in Training. You can add a run’s kcal to your day.
            Quadfather only reads activities and never posts to Strava or changes anything there.
          </p>
        </section>

        {scopeMissing && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setActionError(null); setConfirmOpen(true) }}
            disabled={loading}
            style={{ color: 'var(--over)', alignSelf: 'center' }}
          >
            Disconnect Strava
          </button>
        )}
      </div>

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Disconnect Strava?"
        body="New runs stop coming in. Runs you already have stay in Quadfather."
        confirmLabel="Disconnect"
        busyLabel="Disconnecting…"
        busy={loading}
        error={confirmOpen ? actionError : null}
        onConfirm={handleDisconnect}
      />
    </div>
  )
}
