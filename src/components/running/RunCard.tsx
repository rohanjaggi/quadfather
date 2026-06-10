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
  isLast: boolean
}

export default function RunCard({ run, isLast }: RunCardProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '14px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--surface-border)',
      gap: '12px',
    }}>
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
            fontFamily: 'var(--font-display)',
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
          fontFamily: 'var(--font-display)',
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
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)' }}> kcal</span>
        </p>
      </div>
    </div>
  )
}
