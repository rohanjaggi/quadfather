'use client'

import type { RunLog } from '@/types/running'
import { formatPace } from '@/lib/format'

/**
 * Synced activities must not be badged "Manual". `source` is the primary
 * signal; the activity id is checked too so runs imported before `source` was
 * being set are still recognised.
 */
function sourceLabel(run: RunLog): string {
  if (run.source === 'strava' || run.strava_activity_id != null) return 'Strava'
  if (run.source === 'ai_parsed') return 'AI'
  return 'Manual'
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
            {sourceLabel(run)}
          </span>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          fontFamily: 'var(--font-display)',
          fontSize: '12px',
          color: 'var(--tg-theme-hint-color)',
        }}>
          <span>{formatPace(run.pace_per_km, 'min')} /km</span>
          <span>{formatDuration(run.duration_seconds)}</span>
          {run.average_heartrate != null && <span>{Math.round(run.average_heartrate)} bpm</span>}
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
