'use client'

import { useState, useEffect } from 'react'
import type { WorkoutLog } from '@/types/workouts'
import { aggregateVolumeByDay, aggregateVolumeByWeek, type DailyVolume } from '@/lib/volume'
import { dayKey } from '@/lib/day'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { formatKey, formatKg } from './format'

interface Props {
  workouts: WorkoutLog[]
  period: 7 | 30
}

export default function VolumeTrendsChart({ workouts, period }: Props) {
  const [mounted, setMounted] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => { setMounted(true) }, [])

  const data: DailyVolume[] = period === 7
    ? aggregateVolumeByDay(workouts, 7)
    : aggregateVolumeByWeek(workouts)

  const max = Math.max(...data.map(d => d.volume), 1)
  const totalVolume = data.reduce((s, d) => s + d.volume, 0)

  if (totalVolume === 0) {
    return (
      <SummaryCard title="Volume">
        <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
          No weighted sets {period === 7 ? 'in the last 7 days' : 'in the last 4 weeks'}.
        </p>
      </SummaryCard>
    )
  }

  /** Axis label (short) and spoken label (full). */
  function labels(dateStr: string): { short: string; full: string } {
    if (period === 7) {
      if (dateStr === dayKey()) return { short: 'Today', full: 'Today' }
      return {
        short: formatKey(dateStr, { weekday: 'short' }),
        full: formatKey(dateStr, { weekday: 'long', day: 'numeric', month: 'short' }),
      }
    }
    // Weekly buckets are rolling 7-day windows keyed by their last day.
    const short = formatKey(dateStr, { day: 'numeric', month: 'short' })
    return { short, full: `Week ending ${short}` }
  }

  const pick = selected !== null ? data[selected] : null

  return (
    <SummaryCard title="Volume">
      <p aria-live="polite" style={{ margin: '-6px 0 14px', fontSize: 13, color: 'var(--muted)' }}>
        {pick
          ? <>{labels(pick.date).full} · <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatKg(pick.volume)}</span></>
          : <>{period === 7 ? 'Last 7 days' : 'Last 4 weeks'} · <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatKg(totalVolume)}</span> lifted</>}
      </p>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: period === 7 ? 6 : 10 }}>
        {data.map((d, i) => {
          const on = selected === i
          const { short, full } = labels(d.date)
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={on}
              aria-label={`${full}: ${formatKg(d.volume)}`}
              onClick={() => setSelected(prev => prev === i ? null : i)}
              style={{
                flex: 1, minWidth: 0, minHeight: 44, padding: 0, border: 'none', background: 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6,
              }}
            >
              <span style={{ height: 88, display: 'flex', alignItems: 'flex-end' }}>
                <span style={{
                  width: '100%', borderRadius: '5px 5px 2px 2px',
                  // Ink tints: a data mark, so never the action green.
                  background: on ? 'var(--ink)' : 'rgba(31, 42, 36, 0.22)',
                  height: mounted ? `${Math.max((d.volume / max) * 100, d.volume > 0 ? 4 : 0)}%` : '0%',
                  minHeight: d.volume > 0 ? 3 : 0,
                  transition: 'height 0.6s var(--ease-out-expo), background-color 0.2s ease',
                }} />
              </span>
              <span style={{ fontSize: 13, color: on ? 'var(--ink)' : 'var(--muted)', fontWeight: on ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {short}
              </span>
            </button>
          )
        })}
      </div>
    </SummaryCard>
  )
}
