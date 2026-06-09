'use client'

import { useState, useEffect } from 'react'
import type { WorkoutLog } from '@/types/workouts'
import { aggregateVolumeByDay, aggregateVolumeByWeek, type DailyVolume } from '@/lib/volume'
import SummaryCard from '@/components/dashboard/SummaryCard'

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
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0',
        }}>
          No volume data in this period
        </p>
      </SummaryCard>
    )
  }

  function formatLabel(dateStr: string) {
    const d = new Date(dateStr)
    if (period === 7) {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      if (d.toDateString() === today.toDateString()) return 'Today'
      if (d.toDateString() === yesterday.toDateString()) return 'Yday'
      return d.toLocaleDateString('en-GB', { weekday: 'short' })
    }
    return `Wk ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }

  function formatVolume(v: number) {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
    return `${v}kg`
  }

  return (
    <SummaryCard title="Volume">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {selected !== null && data[selected] && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500,
              color: 'var(--accent)', padding: '4px 10px',
              borderRadius: '8px', backgroundColor: 'var(--tg-theme-bg-color)',
            }}>
              {formatLabel(data[selected].date)}: {formatVolume(data[selected].volume)}
            </span>
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'flex-end',
          gap: period === 7 ? '5px' : '8px', height: '72px',
        }}>
          {data.map((d, i) => {
            const heightPct = d.volume / max
            const isSelected = selected === i
            return (
              <div
                key={d.date}
                onClick={() => setSelected(prev => prev === i ? null : i)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', height: '100%', justifyContent: 'flex-end',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '100%', borderRadius: '4px 4px 2px 2px',
                  backgroundColor: 'var(--accent)',
                  opacity: isSelected ? 1 : 0.6,
                  height: mounted ? `${Math.max(heightPct * 100, d.volume > 0 ? 4 : 0)}%` : '0%',
                  transition: 'height 0.5s var(--ease-smooth), opacity 0.3s ease',
                  transitionDelay: `${i * 40}ms`,
                  minHeight: d.volume > 0 ? '3px' : '0',
                  boxShadow: isSelected ? '0 0 0 2px var(--accent)' : 'none',
                }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: period === 7 ? '5px' : '8px' }}>
          {data.map((d, i) => (
            <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '9px',
                color: selected === i ? 'var(--accent)' : 'var(--tg-theme-hint-color)',
                fontWeight: selected === i ? 600 : 400,
              }}>
                {formatLabel(d.date)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            color: 'var(--tg-theme-hint-color)',
          }}>
            Total: {formatVolume(totalVolume)}
          </span>
        </div>
      </div>
    </SummaryCard>
  )
}
