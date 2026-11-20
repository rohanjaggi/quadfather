'use client'

import { useState } from 'react'
import { useUser } from '@/context/UserContext'
import { errorMessage, errorStatus } from '@/lib/errors'

const screenStyle: React.CSSProperties = {
  minHeight: '100svh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 24px',
  textAlign: 'center',
  backgroundColor: 'var(--ground)',
}

const wordmark: React.CSSProperties = {
  margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--ink)',
}

function BootScreen() {
  return (
    <div style={screenStyle} role="status" aria-label="Loading Quadfather">
      <p style={wordmark}>Quadfather</p>
      {/* Stills under reduced motion via the global `.ai-shimmer` rule. */}
      <div className="ai-shimmer" aria-hidden="true" style={{ width: 72, height: 4, borderRadius: 2, marginTop: 14 }} />
    </div>
  )
}

function ErrorScreen({ title, hint, detail }: { title: string; hint: string; detail?: string }) {
  const { retry } = useUser()
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    try {
      await retry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div style={screenStyle}>
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p style={{ ...wordmark, fontSize: 17, color: 'var(--muted)' }}>Quadfather</p>
        <h1 style={{ margin: '28px 0 8px', fontSize: 26, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--muted)' }}>{hint}</p>

        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="btn-primary"
          style={{ marginTop: 28 }}
        >
          {retrying ? 'Trying again…' : 'Try again'}
        </button>

        {detail && (
          <details style={{ marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
            <summary style={{ padding: '12px 8px', cursor: 'pointer', fontWeight: 600 }}>
              Details
            </summary>
            <p style={{ margin: '4px 0 0', lineHeight: 1.5, wordBreak: 'break-word' }}>{detail}</p>
          </details>
        )}
      </div>
    </div>
  )
}

/** The app only runs inside Telegram: no signed session means "open it from there". */
function isAuthFailure(error: string): boolean {
  const status = errorStatus(error)
  if (status === 401 || status === 403) return true
  return typeof window !== 'undefined' && !window.Telegram?.WebApp?.initData
}

/**
 * Blocks every route until the user is signed in, so pages never render
 * placeholder zeros for a session that failed to load.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useUser()

  if (!user) {
    if (loading) return <BootScreen />
    if (error) {
      return isAuthFailure(error) ? (
        <ErrorScreen
          title="Open Quadfather from Telegram"
          hint="Quadfather only works inside Telegram. Open it from the Quadfather bot, then try again."
          detail={errorMessage(error, 'Could not verify your Telegram session')}
        />
      ) : (
        <ErrorScreen
          title="Can’t reach Quadfather"
          hint="Check your connection, then try again."
          detail={errorMessage(error, 'Could not load your profile')}
        />
      )
    }
    // Boot finished with neither a user nor an error — shouldn't happen, but
    // showing the loader forever leaves no way out, so offer Try again.
    return (
      <ErrorScreen
        title="Couldn’t load your profile"
        hint="Something interrupted loading your data. Try again, and if it keeps happening, reopen Quadfather from Telegram."
      />
    )
  }

  return <>{children}</>
}
