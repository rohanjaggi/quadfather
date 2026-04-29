'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { getStravaConnectUrl, disconnectStrava } from '@/lib/api'
import SummaryCard from '@/components/dashboard/SummaryCard'

export default function StravaSettingsPage() {
  const { user, refresh } = useUser()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connected = !!user?.strava_connected

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const { url } = await getStravaConnectUrl()
      const { default: WebApp } = await import('@twa-dev/sdk')
      WebApp.openLink(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await disconnectStrava()
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="fade-up">
        <Link href="/profile" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-body)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Settings
        </Link>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '5px',
        }}>
          Integration
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          fontWeight: 400,
          lineHeight: 1.1,
          color: 'var(--tg-theme-text-color)',
        }}>
          Strava
        </h1>
      </div>

      <div className="fade-up fade-up-1">
        <SummaryCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                backgroundColor: connected ? '#FC4C021A' : 'var(--tg-theme-bg-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                  fontFamily: 'var(--font-display)',
                  fontSize: '17px',
                  fontWeight: 500,
                  color: 'var(--tg-theme-text-color)',
                }}>
                  {connected ? 'Connected' : 'Not Connected'}
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--tg-theme-hint-color)',
                }}>
                  {connected
                    ? 'Your runs sync automatically'
                    : 'Connect to import your runs'}
                </p>
              </div>
            </div>

            {error && (
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: '#c44',
                padding: '8px 12px',
                borderRadius: '10px',
                backgroundColor: '#c4441a',
              }}>
                {error}
              </p>
            )}

            {/* Action button */}
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
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  border: 'none',
                  backgroundColor: '#FC4C02',
                  color: 'white',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Connecting...' : 'Connect with Strava'}
              </button>
            )}
          </div>
        </SummaryCard>
      </div>

      {/* Info */}
      <div className="fade-up fade-up-2">
        <SummaryCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
              lineHeight: 1.5,
            }}>
              Connecting Strava allows Quadfather to import your running activities.
              Calories from your runs can be added to your daily allowance.
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
              lineHeight: 1.5,
            }}>
              We only read your activity data — we never post or modify anything on your Strava account.
            </p>
          </div>
        </SummaryCard>
      </div>
    </div>
  )
}
