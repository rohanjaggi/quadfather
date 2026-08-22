'use client'

import { useEffect, useState } from 'react'
import { getRunningAnalytics } from '@/lib/api'
import { formatPace } from '@/lib/format'
import { EXERCISE_DAMPENING } from '@/lib/constants'
import { useUser } from '@/context/UserContext'
import type { RunningAnalyticsResponse } from '@/types/running'

export default function WeeklyRunStats() {
  const { runLogs } = useUser()
  const [data, setData] = useState<RunningAnalyticsResponse | null>(null)

  // Refetch whenever the context's runs change (a run was logged, deleted or
  // pulled in by a Strava sync) — otherwise these totals go stale on the page.
  useEffect(() => {
    let cancelled = false
    getRunningAnalytics(7)
      .then(result => { if (!cancelled) setData(result) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [runLogs])

  if (!data || data.totals.run_count === 0) return null

  const avgPace = data.totals.distance > 0
    ? (data.totals.duration / 60) / (data.totals.distance / 1000)
    : undefined

  /**
   * What actually reached the calorie allowance. The API totals now carry
   * `credited_calories`, which respects each run's own `added_to_allowance`
   * flag — the local dampening below counts runs the user excluded, so it is
   * only a fallback for servers that don't send the field yet.
   */
  const totals = data.totals as typeof data.totals & { credited_calories?: number }
  const credited = totals.credited_calories ?? totals.calories * EXERCISE_DAMPENING

  const stats = [
    { label: 'Distance', value: `${(data.totals.distance / 1000).toFixed(1)}`, unit: 'km' },
    { label: 'Runs', value: `${data.totals.run_count}`, unit: 'this week' },
    { label: 'Avg Pace', value: formatPace(avgPace, 'min'), unit: '/km' },
    { label: 'Credited', value: `+${Math.round(credited)}`, unit: 'kcal' },
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
