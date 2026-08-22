'use client'

import { useState } from 'react'
import { useUser } from '@/context/UserContext'
import { errorMessage } from '@/lib/errors'

const screenStyle: React.CSSProperties = {
  minHeight: '100svh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '18px',
  padding: '32px 28px',
  textAlign: 'center',
  backgroundColor: 'var(--tg-theme-bg-color)',
}

function BootScreen() {
  return (
    <div style={screenStyle}>
      <img
        src="/logo.png"
        alt="Quadfather"
        style={{ width: '64px', height: '64px', opacity: 0.7 }}
      />
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          border: '2px solid var(--surface-border)',
          borderTopColor: 'var(--tg-theme-button-color)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
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
    <div style={screenStyle} className="fade-up">
      <img src="/logo.png" alt="Quadfather" style={{ width: '56px', height: '56px', opacity: 0.6 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '24px',
          fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
          color: 'var(--tg-theme-text-color)',
        }}>
          {title}
        </h1>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', lineHeight: 1.5,
        }}>
          {hint}
        </p>
      </div>

      {detail && (
        <p style={{
          fontFamily: 'monospace', fontSize: '11px',
          color: 'var(--accent-calories)', lineHeight: 1.5,
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          border: '1px solid var(--surface-border)',
          borderRadius: '10px', padding: '10px 12px',
          maxWidth: '320px', wordBreak: 'break-word',
        }}>
          {detail}
        </p>
      )}

      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="btn-primary"
        style={{ maxWidth: '220px' }}
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  )
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
      return (
        <ErrorScreen
          title={'Couldn’t sign you in'}
          hint="Please open Quadfather from the Telegram bot — it needs your Telegram session to load your data."
          detail={errorMessage(error, 'Could not verify your Telegram session')}
        />
      )
    }
    // Boot finished with neither a user nor an error — shouldn't happen, but
    // showing the spinner forever leaves no way out, so offer Retry.
    return (
      <ErrorScreen
        title={'Couldn’t load your profile'}
        hint="Something interrupted loading your data. Try again — if it keeps happening, reopen Quadfather from the Telegram bot."
      />
    )
  }

  return <>{children}</>
}
