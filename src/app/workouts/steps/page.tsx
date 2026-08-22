'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSteps } from '@/lib/api'
import type { StepLog } from '@/types/workouts'
import { useUser } from '@/context/UserContext'

/**
 * Step rows are stored at UTC midnight, so the calendar day has to be read off
 * the ISO string. Re-parsing into local time shifts every row back a day east
 * of UTC (in SGT yesterday's row was labelled "Today").
 */
function utcDateKey(value: string): string {
  const head = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function shiftUtcDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr: string): string {
  const key = utcDateKey(dateStr)
  if (!key) return '—'
  const today = new Date().toISOString().slice(0, 10)
  if (key === today) return 'Today'
  if (key === shiftUtcDays(today, -1)) return 'Yesterday'
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export default function StepsHistoryPage() {
  const { user } = useUser()
  const [steps, setSteps] = useState<StepLog[]>([])
  const [loading, setLoading] = useState(true)

  const stepGoal = user?.goals.daily_step_goal ?? 10000

  useEffect(() => {
    getSteps(30).then(data => {
      setSteps(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const maxSteps = Math.max(...steps.map(s => s.steps), stepGoal)
  const totalSteps = steps.reduce((sum, s) => sum + s.steps, 0)
  const avgSteps = steps.length > 0 ? Math.round(totalSteps / steps.length) : 0
  const bestDay = steps.length > 0 ? Math.max(...steps.map(s => s.steps)) : 0
  const daysAboveGoal = steps.filter(s => s.steps >= stepGoal).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
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
        }}>Steps</h1>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', marginTop: '4px',
        }}>Last 30 days</p>
      </div>

      {/* Summary stats */}
      {!loading && steps.length > 0 && (
        <div className="fade-up fade-up-1" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          <div style={{
            padding: '14px 16px', borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)', fontWeight: 400,
            }}>Daily average</span>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600,
              color: 'var(--tg-theme-text-color)', marginTop: '3px', letterSpacing: '-0.02em',
            }}>{avgSteps.toLocaleString()}</div>
          </div>
          <div style={{
            padding: '14px 16px', borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)', fontWeight: 400,
            }}>Best day</span>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600,
              color: 'var(--tg-theme-text-color)', marginTop: '3px', letterSpacing: '-0.02em',
            }}>{bestDay.toLocaleString()}</div>
          </div>
          <div style={{
            padding: '14px 16px', borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)', fontWeight: 400,
            }}>Total</span>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600,
              color: 'var(--tg-theme-text-color)', marginTop: '3px', letterSpacing: '-0.02em',
            }}>{totalSteps.toLocaleString()}</div>
          </div>
          <div style={{
            padding: '14px 16px', borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)', fontWeight: 400,
            }}>Days at goal</span>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600,
              color: daysAboveGoal > 0 ? 'var(--accent-protein)' : 'var(--tg-theme-text-color)',
              marginTop: '3px', letterSpacing: '-0.02em',
            }}>{daysAboveGoal}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--tg-theme-hint-color)', marginLeft: '2px' }}>/ {steps.length}</span></div>
          </div>
        </div>
      )}

      {/* Daily breakdown */}
      <div className="fade-up fade-up-2">
        {loading ? (
          <div style={{
            padding: '40px 0', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontSize: '13px',
            color: 'var(--tg-theme-hint-color)',
          }}>Loading...</div>
        ) : steps.length === 0 ? (
          <div style={{
            padding: '40px 0', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontSize: '13px',
            color: 'var(--tg-theme-hint-color)',
          }}>No step data yet. Set up iOS Shortcut sync in Settings.</div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column',
            borderRadius: '16px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            overflow: 'hidden',
          }}>
            {steps.map((entry, i) => {
              const progress = entry.steps / maxSteps
              const hitGoal = entry.steps >= stepGoal
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--surface-border)',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 400,
                    color: 'var(--tg-theme-hint-color)',
                    width: '80px', flexShrink: 0,
                  }}>
                    {formatDate(entry.date)}
                  </span>
                  <div style={{ flex: 1, height: '4px', borderRadius: '99px', backgroundColor: 'var(--tg-theme-bg-color)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '99px',
                      width: `${progress * 100}%`,
                      backgroundColor: hitGoal ? 'var(--accent-protein)' : 'var(--accent)',
                      transition: 'width 0.4s var(--ease-out-expo)',
                    }} />
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500,
                    color: hitGoal ? 'var(--accent-protein)' : 'var(--tg-theme-text-color)',
                    width: '52px', textAlign: 'right', flexShrink: 0,
                  }}>
                    {entry.steps.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
