'use client'

import Link from 'next/link'
import type { WorkoutLog } from '@/types/workouts'
import SummaryCard from '@/components/dashboard/SummaryCard'
import WorkoutAnalysis from './WorkoutAnalysis'
import { useUser } from '@/context/UserContext'
import { dayKey } from '@/lib/day'
import { RowsSkeleton, ErrorRetry, linkStyle } from './bits'
import { formatKg, relativeDay, sessionVolume, setsSummary } from './format'

/**
 * The most recent session, as list rows, with its coaching note underneath.
 * The page owns the 30-day fetch so it can fold the empty Training screen.
 */
export default function RecentWorkouts({ workouts, error, onRetry }: {
  /** Last 30 days, newest first; null while loading. */
  workouts: WorkoutLog[] | null
  error: string | null
  onRetry: () => void
}) {
  const { user } = useUser()

  const loading = workouts === null && !error
  const last = workouts?.[0] ?? null

  const action = <Link href="/workouts/history" style={linkStyle}>History</Link>

  if (loading) return <SummaryCard title="Last session" action={action}><RowsSkeleton rows={3} /></SummaryCard>
  if (error) return <SummaryCard title="Last session"><ErrorRetry message={error} onRetry={onRetry} /></SummaryCard>
  if (!last) {
    return (
      <SummaryCard title="Last session">
        <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
          Nothing logged in the last 30 days. Your next session shows up here.
        </p>
      </SummaryCard>
    )
  }

  const volume = sessionVolume(last)
  const meta = [
    relativeDay(dayKey(new Date(last.workout_date))),
    last.duration_minutes ? `${last.duration_minutes} min` : null,
    last.calories_burned ? `${Math.round(last.calories_burned)} kcal` : null,
  ].filter(Boolean).join(' · ')

  return (
    <SummaryCard title="Last session" action={action}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: -6 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{meta}</p>
        </div>
        {volume > 0 && <p style={{ margin: 0, flexShrink: 0, fontSize: 16, fontWeight: 600 }}>{formatKg(volume)}</p>}
      </div>
      <ol style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
        {last.exercises.map((ex, i) => (
          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <span style={{ minWidth: 0, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.exercise_name}</span>
            <span style={{ flexShrink: 0, fontSize: 15, color: 'var(--muted)' }}>{setsSummary(ex.sets)}</span>
          </li>
        ))}
      </ol>
      {/* Analysis is a paid call: it runs only when the user taps for it. */}
      {(last.analysis || user?.has_api_key) && (
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <WorkoutAnalysis
            workoutId={last.id}
            existingAnalysis={last.analysis}
            exercises={last.exercises}
          />
        </div>
      )}
    </SummaryCard>
  )
}
