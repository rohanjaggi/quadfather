'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import WeeklyRunStats from '@/components/running/BurnSummary'
import RunningPRs from '@/components/running/RunningPRs'
import RunsList from '@/components/running/RunsList'
import ManualRunForm from '@/components/running/ManualRunForm'
import RunPhotoUpload from '@/components/running/RunPhotoUpload'
import StravaSync from '@/components/running/StravaSync'

type Mode = null | 'photo' | 'manual'

export default function RunningPage() {
  const [mode, setMode] = useState<Mode>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [mode])

  function toggle(next: Mode) {
    setMode(prev => prev === next ? null : next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      <div className="fade-up">
        <Link href="/workouts" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '8px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Exercise
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700,
          lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>Running</h1>
      </div>

      <div className="fade-up fade-up-1">
        <StravaSync />
      </div>

      <div className="fade-up fade-up-2">
        <WeeklyRunStats />
      </div>

      <div className="fade-up fade-up-3">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {([
            { key: 'photo' as const, label: 'Screenshot', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )},
            { key: 'manual' as const, label: 'Manual', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )},
          ]).map(({ key: k, label, icon }) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '6px', padding: '14px 8px', borderRadius: '14px',
                border: mode === k ? '1.5px solid var(--tg-theme-button-color)' : '1.5px solid var(--surface-border)',
                backgroundColor: mode === k ? 'var(--tg-theme-button-color)' : 'transparent',
                color: mode === k ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500,
                letterSpacing: '0.02em', cursor: 'pointer',
                transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode && (
        <div ref={panelRef} className="fade-up" style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '20px', padding: '20px',
        }}>
          {mode === 'photo' && <RunPhotoUpload onClose={() => setMode(null)} />}
          {mode === 'manual' && <ManualRunForm onClose={() => setMode(null)} />}
        </div>
      )}

      <div className="fade-up fade-up-4">
        <RunningPRs />
      </div>

      <div className="fade-up fade-up-5">
        <RunsList />
      </div>

      <div className="fade-up fade-up-5">
        <Link href="/running/history" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px', padding: '12px',
          borderRadius: '12px',
          border: '1px solid var(--surface-border)',
          fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500,
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          transition: 'background-color 0.15s ease',
        }}>
          View Run History
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

    </div>
  )
}
