'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getRunHistory } from '@/lib/api'
import type { RunLog } from '@/types/running'

function formatPace(pace: number | undefined | null): string {
  if (!pace) return '--:--'
  const mins = Math.floor(pace)
  const secs = Math.round((pace - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}min`
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - now.getDay() + 1)
  startOfThisWeek.setHours(0, 0, 0, 0)

  const startOfLastWeek = new Date(startOfThisWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  if (d >= startOfThisWeek) return 'This Week'
  if (d >= startOfLastWeek) return 'Last Week'

  const weekStart = new Date(d)
  weekStart.setDate(d.getDate() - d.getDay() + 1)
  return weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' week'
}

function formatRunDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const run = new Date(d)
  run.setHours(0, 0, 0, 0)

  const diff = Math.round((today.getTime() - run.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface WeekGroup {
  label: string
  runs: RunLog[]
  totalKm: number
  totalDuration: number
}

export default function RunHistoryPage() {
  const [runs, setRuns] = useState<RunLog[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    setLoading(true)
    getRunHistory(days).then(setRuns).catch(() => setRuns([])).finally(() => setLoading(false))
  }, [days])

  const weeks: WeekGroup[] = []
  for (const run of runs) {
    const label = getWeekLabel(run.run_date)
    const existing = weeks.find(w => w.label === label)
    if (existing) {
      existing.runs.push(run)
      existing.totalKm += run.distance_meters / 1000
      existing.totalDuration += run.duration_seconds
    } else {
      weeks.push({
        label,
        runs: [run],
        totalKm: run.distance_meters / 1000,
        totalDuration: run.duration_seconds,
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      <div className="fade-up">
        <Link href="/running" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '8px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Running
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700,
          lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>Run History</h1>
      </div>

      <div className="fade-up fade-up-1" style={{ display: 'flex', gap: '8px' }}>
        {[30, 60, 90].map(d => (
          <button
            key={d}
            className="btn-pill"
            data-active={days === d ? 'true' : undefined}
            onClick={() => setDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '24px 0',
        }}>
          Loading...
        </p>
      )}

      {!loading && runs.length === 0 && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '24px 0',
        }}>
          No runs in this period
        </p>
      )}

      {!loading && weeks.map(week => (
        <div key={week.label} className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 500,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--tg-theme-hint-color)',
            }}>
              {week.label}
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
            }}>
              {week.totalKm.toFixed(1)}km · {formatDuration(week.totalDuration)}
            </p>
          </div>

          <div style={{
            borderRadius: '16px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            overflow: 'hidden',
          }}>
            {week.runs.map((run, i) => (
              <div
                key={run.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: i < week.runs.length - 1 ? '1px solid var(--surface-border)' : 'none',
                }}
              >
                <div>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '15px',
                    fontWeight: 500, color: 'var(--tg-theme-text-color)', marginBottom: '3px',
                  }}>
                    {(run.distance_meters / 1000).toFixed(2)} km
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '11px',
                    color: 'var(--tg-theme-hint-color)',
                  }}>
                    {formatRunDate(run.run_date)} · {formatPace(run.pace_per_km)} /km · {formatDuration(run.duration_seconds)}
                  </p>
                </div>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '14px',
                  fontWeight: 500, color: 'var(--accent-calories)',
                }}>
                  {Math.round(run.calories_burned)}
                  <span style={{ fontSize: '10px', color: 'var(--tg-theme-hint-color)', marginLeft: '2px' }}>kcal</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}
