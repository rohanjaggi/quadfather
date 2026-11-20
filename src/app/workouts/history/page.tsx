'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Sheet from '@/components/ui/Sheet'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { toast } from '@/components/ui/Toast'
import { deferWithUndo } from '@/components/ui/undo'
import { ChevronRightIcon, TrashIcon } from '@/components/ui/icons'
import { useHaptic } from '@/components/telegram'
import VolumeTrendsChart from '@/components/workouts/VolumeTrendsChart'
import WorkoutAnalysis from '@/components/workouts/WorkoutAnalysis'
import { ErrorRetry, RowsSkeleton, friendlyError } from '@/components/workouts/bits'
import { formatKey, formatKg, formatSet, relativeDay, sessionVolume, weekStartKey } from '@/components/workouts/format'
import { deleteWorkout, getWorkouts } from '@/lib/api'
import { addDays, dayKey } from '@/lib/day'
import { useUser } from '@/context/UserContext'
import type { WorkoutLog } from '@/types/workouts'

/** First window, then each "Show earlier weeks" adds twelve, up to the route's one-year cap. */
const FIRST_DAYS = 56
const MORE_DAYS = 84
const MAX_DAYS = 365

const workoutKey = (w: WorkoutLog) => dayKey(new Date(w.workout_date))
const newestFirst = (a: WorkoutLog, b: WorkoutLog) => new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime()

function weekTitle(start: string): string {
  const thisWeek = weekStartKey()
  if (start === thisWeek) return 'This week'
  if (start === addDays(thisWeek, -7)) return 'Last week'
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${formatKey(start, opts)} – ${formatKey(addDays(start, 6), opts)}`
}

export default function WorkoutHistoryPage() {
  const { user, refresh } = useUser()
  const haptic = useHaptic()

  const [days, setDays] = useState(FIRST_DAYS)
  const [attempt, setAttempt] = useState(0)
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    getWorkouts(days)
      .then(data => { if (!stale) setWorkouts(data) })
      .catch(err => { if (!stale) setError(friendlyError(err, 'Couldn’t load your sessions.')) })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [days, attempt])

  // Newest first from the route, so weeks and the sessions in them stay in order.
  const weeks = useMemo(() => {
    const out: { start: string; items: WorkoutLog[] }[] = []
    for (const w of workouts) {
      const start = weekStartKey(workoutKey(w))
      const last = out[out.length - 1]
      if (last && last.start === start) last.items.push(w)
      else out.push({ start, items: [w] })
    }
    return out
  }, [workouts])

  const [open, setOpen] = useState<WorkoutLog | null>(null)
  const closeSheet = useCallback(() => setOpen(null), [])

  // The row goes at once; the server delete waits out the Undo window.
  function remove(w: WorkoutLog) {
    haptic.notification('warning')
    const restore = () => setWorkouts(prev => (prev.some(x => x.id === w.id) ? prev : [...prev, w].sort(newestFirst)))
    setWorkouts(prev => prev.filter(x => x.id !== w.id))
    closeSheet()
    deferWithUndo({
      message: 'Session deleted',
      commit: () => {
        deleteWorkout(w.id).then(
          // Today and Training read the week from context.
          () => refresh().catch(err => console.error('Failed to refresh after delete:', err)),
          err => {
            toast(friendlyError(err, 'Couldn’t delete this session. It’s back in your list.'))
            restore()
          },
        )
      },
      undo: restore,
    })
  }

  const range = days >= MAX_DAYS ? 'the last year' : `the last ${Math.round(days / 7)} weeks`
  const firstLoad = loading && workouts.length === 0

  const showEarlier = days < MAX_DAYS && !error && !firstLoad && (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => setDays(d => Math.min(MAX_DAYS, d + MORE_DAYS))}
      disabled={loading}
    >
      {loading ? 'Loading…' : 'Show earlier weeks'}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader title="History" back={{ href: '/workouts', label: 'Training' }} />

      {firstLoad ? (
        <SummaryCard><RowsSkeleton rows={4} /></SummaryCard>
      ) : error ? (
        <SummaryCard><ErrorRetry message={error} onRetry={() => setAttempt(n => n + 1)} busy={loading} /></SummaryCard>
      ) : workouts.length === 0 ? (
        <SummaryCard>
          <p style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--muted)' }}>No sessions in {range}.</p>
          <Link href="/workouts/log" className="btn-primary" style={{ textDecoration: 'none' }}>Start a workout</Link>
        </SummaryCard>
      ) : (
        <>
          <VolumeTrendsChart workouts={workouts} period={30} />

          {weeks.map(week => {
            const vol = week.items.reduce((s, w) => s + sessionVolume(w), 0)
            return (
              <SummaryCard
                key={week.start}
                title={weekTitle(week.start)}
                action={
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {week.items.length} {week.items.length === 1 ? 'session' : 'sessions'}{vol > 0 && ` · ${formatKg(vol)}`}
                  </span>
                }
              >
                <ul style={{ listStyle: 'none', margin: '-8px 0 -6px', padding: 0 }}>
                  {week.items.map((w, i) => {
                    const v = sessionVolume(w)
                    const n = w.exercises.length
                    return (
                      <li key={w.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                        <button
                          type="button"
                          onClick={() => setOpen(w)}
                          style={{
                            width: '100%', minHeight: 60, padding: '10px 0', border: 'none', background: 'transparent',
                            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: 'var(--ink)',
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                              {relativeDay(workoutKey(w))} · {n} {n === 1 ? 'exercise' : 'exercises'}
                            </span>
                          </span>
                          {v > 0 && <span style={{ flexShrink: 0, fontSize: 15, fontWeight: 600 }}>{formatKg(v)}</span>}
                          <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </SummaryCard>
            )
          })}

          {showEarlier}
        </>
      )}

      <Sheet open={open !== null} onClose={closeSheet} title={open?.name ?? ''}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: '-8px 0 0', fontSize: 15, color: 'var(--muted)' }}>
              {[
                formatKey(workoutKey(open), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                open.duration_minutes ? `${open.duration_minutes} min` : null,
                open.calories_burned ? `${Math.round(open.calories_burned)} kcal` : null,
                sessionVolume(open) > 0 ? `${formatKg(sessionVolume(open))} lifted` : null,
              ].filter(Boolean).join(' · ')}
            </p>

            <section className="card" aria-label="Exercises" style={{ padding: '6px 18px' }}>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {open.exercises.map((ex, i) => (
                  <li key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{ex.exercise_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--muted)' }}>{ex.sets.map(formatSet).join(', ')}</p>
                  </li>
                ))}
              </ol>
            </section>

            {open.notes && <p style={{ margin: 0, fontSize: 15, color: 'var(--ink)' }}>{open.notes}</p>}

            <WorkoutAnalysis
              title={open.analysis || user?.has_api_key ? 'How it went' : 'Muscles worked'}
              workoutId={open.id}
              existingAnalysis={open.analysis}
              exercises={open.exercises}
              showMap
            />

            <button
              type="button"
              className="btn-ghost"
              onClick={() => remove(open)}
              style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--over)' }}
            >
              <TrashIcon size={18} /> Delete session
            </button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
