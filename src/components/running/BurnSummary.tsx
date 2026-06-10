'use client'

import { useEffect, useState } from 'react'
import { getRunningAnalytics } from '@/lib/api'
import type { RunningAnalyticsResponse } from '@/types/running'

function formatPace(pace: number | undefined): string {
  if (!pace) return '--:--'
  const mins = Math.floor(pace)
  const secs = Math.round((pace - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function WeeklyRunStats() {
  const [data, setData] = useState<RunningAnalyticsResponse | null>(null)

  useEffect(() => {
    getRunningAnalytics(7).then(setData).catch(() => {})
  }, [])

  if (!data || data.totals.run_count === 0) return null

  const avgPace = data.totals.distance > 0
    ? (data.totals.duration / 60) / (data.totals.distance / 1000)
    : undefined

  const stats = [
    { label: 'Distance', value: `${(data.totals.distance / 1000).toFixed(1)}`, unit: 'km' },
    { label: 'Runs', value: `${data.totals.run_count}`, unit: 'this week' },
    { label: 'Avg Pace', value: formatPace(avgPace), unit: '/km' },
    { label: 'Credited', value: `+${Math.round(data.totals.calories * 0.5)}`, unit: 'kcal' },
  ]

  return (
    <div className="card" style={{ padding: '18px' }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--tg-theme-hint-color)',
        marginBottom: '14px',
      }}>
        This Week
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 12px' }}>
        {stats.map(s => (
          <div key={s.label}>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--tg-theme-text-color)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              {s.value}
              <span style={{
                fontSize: '11px',
                fontWeight: 400,
                color: 'var(--tg-theme-hint-color)',
                marginLeft: '3px',
              }}>
                {s.unit}
              </span>
            </p>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
              marginTop: '3px',
            }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
