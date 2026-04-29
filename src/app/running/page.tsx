'use client'

import { useState } from 'react'
import StravaStatus from '@/components/running/StravaStatus'
import BurnSummary from '@/components/running/BurnSummary'
import RunsList from '@/components/running/RunsList'
import ManualRunForm from '@/components/running/ManualRunForm'
import RunPhotoUpload from '@/components/running/RunPhotoUpload'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'

type Mode = null | 'photo' | 'manual'

export default function RunningPage() {
  const { syncStrava, user } = useUser()
  const [mode, setMode] = useState<Mode>(null)
  const [syncing, setSyncing] = useState(false)

  function toggle(next: Mode) {
    setMode(prev => prev === next ? null : next)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await syncStrava()
    } finally {
      setSyncing(false)
    }
  }

  const stravaConnected = !!user?.strava_connected

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)',
            marginBottom: '5px',
          }}>
            Exercise
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '36px',
            fontWeight: 400,
            lineHeight: 1.1,
            color: 'var(--tg-theme-text-color)',
          }}>
            Running
          </h1>
        </div>
        <StravaStatus />
      </div>

      {stravaConnected && (
        <div className="fade-up fade-up-1">
          <button
            className="btn-secondary"
            onClick={handleSync}
            disabled={syncing}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            {syncing ? 'Syncing…' : 'Sync from Strava'}
          </button>
        </div>
      )}

      <div className="fade-up fade-up-1">
        <BurnSummary />
      </div>

      <div className="fade-up fade-up-2">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-pill" data-active={mode === 'photo' ? 'true' : undefined} onClick={() => toggle('photo')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Screenshot
          </button>
          <button className="btn-pill" data-active={mode === 'manual' ? 'true' : undefined} onClick={() => toggle('manual')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Manual
          </button>
        </div>
      </div>

      {mode === 'photo' && (
        <div className="fade-up">
          <SummaryCard>
            <RunPhotoUpload onClose={() => setMode(null)} />
          </SummaryCard>
        </div>
      )}

      {mode === 'manual' && (
        <div className="fade-up">
          <SummaryCard>
            <ManualRunForm onClose={() => setMode(null)} />
          </SummaryCard>
        </div>
      )}

      <div className="fade-up fade-up-3">
        <RunsList />
      </div>

    </div>
  )
}
