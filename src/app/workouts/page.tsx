'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { getRunHistory } from '@/lib/api'
import type { RunLog } from '@/types/running'
import ActivityHighlights from '@/components/dashboard/ActivityHighlights'

function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff}d ago`
}

/**
 * Monday 00:00 UTC of the week containing `date`.
 *
 * `run_date` is stored and parsed as UTC, so the boundary has to be UTC too —
 * a local-midnight start put runs from Sunday evening (UTC Monday) outside the
 * week for anyone east of UTC, and pulled last Sunday in for anyone west.
 */
function startOfWeekUTC(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  return start
}

export default function ExercisePage() {
  const { user, todaySteps, weeklySteps, weeklyWorkouts, runLogs } = useUser()

  // The context only holds *today's* runs, so "this week" needs its own fetch.
  // Refetched when the context's runs change so a new run shows up immediately.
  const [weekRuns, setWeekRuns] = useState<RunLog[]>([])

  useEffect(() => {
    let cancelled = false
    getRunHistory(7)
      .then(runs => {
        if (cancelled) return
        const weekStart = startOfWeekUTC(new Date())
        setWeekRuns(runs.filter(r => new Date(r.run_date) >= weekStart))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [runLogs])

  const lastWorkout = weeklyWorkouts.length > 0 ? weeklyWorkouts[0] : null
  const workoutDesc = lastWorkout
    ? `Last: ${lastWorkout.name}, ${daysAgo(lastWorkout.workout_date)}`
    : `${weeklyWorkouts.length} sessions this week`

  const totalKm = weekRuns.reduce((sum, r) => sum + r.distance_meters, 0) / 1000
  const runDesc = weekRuns.length > 0
    ? `${weekRuns.length} ${weekRuns.length === 1 ? 'run' : 'runs'}, ${totalKm.toFixed(1)}km this week`
    : 'Log a run to get started'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="fade-up">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 500,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '5px',
        }}>Training</p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700,
          lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>Exercise</h1>
      </div>

      {/* Activity Highlights */}
      <div className="fade-up fade-up-1">
        <ActivityHighlights
          todaySteps={todaySteps}
          weeklySteps={weeklySteps}
          stepGoal={user?.goals.daily_step_goal}
        />
      </div>

      {/* Section label */}
      <div className="fade-up fade-up-2">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 500,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
        }}>Log Activity</p>
      </div>

      {/* Navigation buttons */}
      <div className="fade-up fade-up-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Link href="/workouts/log" style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '18px 16px',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          textDecoration: 'none',
          transition: 'opacity 0.15s ease',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 6.5h11v11h-11z" />
              <path d="M6.5 6.5L4 4" />
              <path d="M17.5 6.5L20 4" />
              <path d="M17.5 17.5L20 20" />
              <path d="M6.5 17.5L4 20" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600,
              color: 'var(--tg-theme-text-color)', marginBottom: '2px',
            }}>Workouts</p>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{workoutDesc}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--tg-theme-hint-color)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        <Link href="/running" style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '18px 16px',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          textDecoration: 'none',
          transition: 'opacity 0.15s ease',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="17" cy="4" r="2" />
              <path d="M15.59 13.51l-1.63-1.2-2.45 3.03-2.6-2.6-3.41 3.76" />
              <path d="M13.96 12.31l2.69-3.39-2.84-2.1-2.84 3.52" />
              <path d="M9.5 16.5L7 22" />
              <path d="M14 22l-1.5-5" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600,
              color: 'var(--tg-theme-text-color)', marginBottom: '2px',
            }}>Running</p>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{runDesc}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--tg-theme-hint-color)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
