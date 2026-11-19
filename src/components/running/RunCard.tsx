'use client'

import type { RunLog } from '@/types/running'
import { formatDuration, formatPace } from '@/lib/format'
import { addDays, dayKey } from '@/lib/day'
import { ChevronRightIcon } from '@/components/ui/icons'

/**
 * Synced activities must not be labelled "Manual". `source` is the primary
 * signal; the activity id is checked too so runs imported before `source` was
 * being set are still recognised.
 */
export function sourceLabel(run: RunLog): string {
  if (run.source === 'strava' || run.strava_activity_id != null) return 'Synced from Strava'
  if (run.source === 'ai_parsed') return 'Read from a screenshot'
  return 'Entered manually'
}

export function isStrava(run: RunLog): boolean {
  return run.source === 'strava' || run.strava_activity_id != null
}

export function formatKm(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

/** Minutes per km: the stored pace, or worked out from time and distance. */
export function runPace(run: RunLog): number | undefined {
  if (run.pace_per_km) return run.pace_per_km
  return run.distance_meters > 0 ? (run.duration_seconds / 60) / (run.distance_meters / 1000) : undefined
}

/** Formats a `YYYY-MM-DD` key as that calendar date, whatever the device timezone. */
export function formatKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
}

/** "Today", "Yesterday", or "Thu 20 Nov", on the app's Singapore day. */
export function formatRunDate(iso: string): string {
  const key = dayKey(new Date(iso))
  if (key === dayKey()) return 'Today'
  if (key === addDays(dayKey(), -1)) return 'Yesterday'
  return formatKey(key, { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * One run as a list row: distance leads, then date, pace and time. With
 * `onOpen` the row is a button that opens the run's details.
 */
export default function RunCard({
  run,
  first,
  landed = false,
  onOpen,
}: {
  run: RunLog
  first: boolean
  landed?: boolean
  onOpen?: (run: RunLog) => void
}) {
  const content = (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          {formatKm(run.distance_meters)}
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>
          {formatRunDate(run.run_date)} · {formatPace(runPace(run), 'min')} /km · {formatDuration(run.duration_seconds)}
        </span>
      </span>
      <span style={{ flexShrink: 0, textAlign: 'right' }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
          {Math.round(run.calories_burned)} kcal
        </span>
        {run.added_to_allowance === false && (
          <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>Not in budget</span>
        )}
      </span>
    </>
  )

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60,
    padding: '10px 0', border: 'none', background: 'transparent', textAlign: 'left',
  }

  return (
    <li
      className={landed ? 'row-landed' : undefined}
      style={{ borderTop: first ? 'none' : '1px solid var(--line)' }}
    >
      {onOpen ? (
        <button type="button" onClick={() => onOpen(run)} style={rowStyle}>
          {content}
          <span style={{ color: 'var(--muted)', display: 'grid', flexShrink: 0 }}><ChevronRightIcon size={18} /></span>
        </button>
      ) : (
        <div style={rowStyle}>{content}</div>
      )}
    </li>
  )
}

/** Quiet placeholder rows while runs load. */
export function RunRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ padding: '14px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
          <div style={{ width: 84, height: 16, borderRadius: 6, background: 'var(--track)' }} />
          <div style={{ width: 168, height: 12, borderRadius: 6, background: 'var(--track)', marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}
