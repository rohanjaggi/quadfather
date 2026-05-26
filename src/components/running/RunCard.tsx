'use client'

import type { RunLog } from '@/types/running'

function formatPace(pacePerKm: number | undefined | null): string {
  if (!pacePerKm) return '--:--'
  const mins = Math.floor(pacePerKm)
  const secs = Math.round((pacePerKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

interface RunCardProps {
  run: RunLog
  onToggle: (id: number, added: boolean) => void
  onDelete: (id: number) => void
  isLast: boolean
}

export default function RunCard({ run, onToggle, onDelete, isLast }: RunCardProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '14px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--surface-border)',
      gap: '12px',
    }}>
      <button
        onClick={() => onToggle(run.id, !run.added_to_allowance)}
        style={{
          width: 22,
          height: 22,
          borderRadius: '6px',
          border: `2px solid ${run.added_to_allowance ? 'var(--accent-calories)' : 'var(--surface-border)'}`,
          backgroundColor: run.added_to_allowance ? 'var(--accent-calories)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s ease',
        }}
      >
        {run.added_to_allowance && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 500,
            color: 'var(--tg-theme-text-color)',
          }}>
            {formatDistance(run.distance_meters)}
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '99px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-hint-color)',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {run.source === 'ai_parsed' ? 'AI' : 'Manual'}
          </span>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          color: 'var(--tg-theme-hint-color)',
        }}>
          <span>{formatPace(run.pace_per_km)} /km</span>
          <span>{formatDuration(run.duration_seconds)}</span>
          {run.average_heartrate && <span>{Math.round(run.average_heartrate)} bpm</span>}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--accent-calories)',
          marginBottom: '2px',
        }}>
          {Math.round(run.calories_burned)}
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--tg-theme-hint-color)' }}> kcal</span>
        </p>
        <button
          onClick={() => onDelete(run.id)}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--tg-theme-hint-color)',
            opacity: 0.6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
