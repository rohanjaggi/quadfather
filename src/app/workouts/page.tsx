'use client'

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { getRunHistory, getWorkouts } from '@/lib/api'
import type { RunLog } from '@/types/running'
import type { WorkoutLog } from '@/types/workouts'
import { addDays, dayKey } from '@/lib/day'
import { formatInt } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { CheckIcon, ChevronRightIcon, ClockIcon, PlusIcon, RunIcon, StepsIcon, TrophyIcon } from '@/components/ui/icons'
import RecentWorkouts from '@/components/workouts/RecentWorkouts'
import MuscleBalance from '@/components/workouts/MuscleBalance'
import MuscleMap from '@/components/workouts/MuscleMap'
import PersonalRecords from '@/components/workouts/PersonalRecords'
import TrainingRecap from '@/components/workouts/TrainingRecap'
import { friendlyError } from '@/components/workouts/bits'
import { formatKey, formatKg, sessionVolume, weekStartKey } from '@/components/workouts/format'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function TrainingPage() {
  const { user, todaySteps, weeklyWorkouts, runLogs } = useUser()
  const today = dayKey()
  const monday = weekStartKey(today)

  // `weeklyWorkouts` is the last 7 days including today, which always covers
  // Monday of this week; it refreshes after every log.
  const thisWeek = useMemo(
    () => weeklyWorkouts.filter(w => dayKey(new Date(w.workout_date)) >= monday),
    [weeklyWorkouts, monday],
  )
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(monday, i)
    return { key, done: thisWeek.some(w => dayKey(new Date(w.workout_date)) === key) }
  })
  const volume = thisWeek.reduce((sum, w) => sum + sessionVolume(w), 0)
  const doneNames = days.filter(d => d.done).map(d => formatKey(d.key, { weekday: 'long' }))

  // The context only holds *today's* runs, so "this week" needs its own fetch.
  // Refetched when the context's runs change so a new run shows up immediately.
  const [weekRuns, setWeekRuns] = useState<RunLog[] | null>(null)
  useEffect(() => {
    let cancelled = false
    getRunHistory(7)
      .then(runs => {
        if (cancelled) return
        setWeekRuns(runs.filter(r => dayKey(new Date(r.run_date)) >= monday))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [runLogs, monday])

  // Last 30 days, for the Last session card and to tell an empty window apart.
  const [recent, setRecent] = useState<WorkoutLog[] | null>(null)
  const [recentError, setRecentError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    setRecent(null)
    setRecentError(null)
    getWorkouts(30)
      .then(data => { if (!stale) setRecent(data) })
      .catch(err => { if (!stale) setRecentError(friendlyError(err, 'Couldn’t load your last session.')) })
    return () => { stale = true }
  }, [attempt])

  // Nothing in the 30-day window: one card says what fills in, instead of three empty ones.
  const noSessions = weeklyWorkouts.length === 0 && recent?.length === 0
  // An empty week can't tell "new" from "lapsed" until the 30-day list lands.
  const undecided = weeklyWorkouts.length === 0 && recent === null && !recentError

  const runKm = (weekRuns ?? []).reduce((sum, r) => sum + r.distance_meters, 0) / 1000
  const more: { href: string; label: string; value?: string; Icon: ComponentType<{ size?: number }> }[] = [
    { href: '/workouts/history', label: 'History', value: `${thisWeek.length} this week`, Icon: ClockIcon },
    { href: '/workouts/prs', label: 'Records', Icon: TrophyIcon },
    {
      href: '/running', label: 'Runs', Icon: RunIcon,
      value: weekRuns && weekRuns.length > 0 ? `${weekRuns.length} · ${runKm.toFixed(1)} km this week` : undefined,
    },
    { href: '/workouts/steps', label: 'Steps', value: `${formatInt(todaySteps)} today`, Icon: StepsIcon },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader title="Training" />

      {/* This week: the glance, then the one thing to do */}
      <section className="card" aria-labelledby="this-week">
        <h2 id="this-week" className="card-title" style={{ margin: '0 0 14px' }}>This week</h2>
        <ol
          role="img"
          aria-label={doneNames.length > 0 ? `Sessions this week: ${doneNames.join(', ')}` : 'No sessions yet this week'}
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', justifyItems: 'center', rowGap: 6 }}
        >
          {days.map((d, i) => {
            const isToday = d.key === today
            const future = d.key > today
            return (
              <li key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  // Filled with a tick when trained, an open ring when not: shape, not just colour.
                  background: d.done ? 'var(--ink)' : 'transparent',
                  border: d.done ? 'none' : `1.5px ${future ? 'dashed' : 'solid'} ${isToday ? 'var(--ink)' : 'var(--line-strong)'}`,
                  color: 'var(--card)',
                }}>
                  {d.done && <CheckIcon size={16} strokeWidth={2.4} />}
                </span>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--ink)' : 'var(--muted)' }}>
                  {DAY_LETTERS[i]}
                </span>
              </li>
            )
          })}
        </ol>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, margin: '18px 0 16px' }}>
          <p style={{ margin: 0, lineHeight: 1 }}>
            <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em' }}>{thisWeek.length}</span>
            <span style={{ marginLeft: 6, fontSize: 17, fontWeight: 600, color: 'var(--muted)' }}>
              {thisWeek.length === 1 ? 'session' : 'sessions'}
            </span>
          </p>
          <p style={{ margin: 0, paddingBottom: 3, textAlign: 'right', lineHeight: 1.15 }}>
            <span style={{ display: 'block', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{formatKg(volume)}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>lifted</span>
          </p>
        </div>

        <Link href="/workouts/log" className="btn-primary" style={{ textDecoration: 'none' }}>
          <PlusIcon size={20} strokeWidth={2} /> Start a workout
        </Link>
      </section>

      {noSessions ? (
        <SummaryCard title="What fills in here">
          {/* The map's neutral state, drawn as a ghost; the sentence carries the meaning. */}
          <div aria-hidden="true">
            <MuscleMap intensities={{}} size="sm" sex={user?.personal?.sex} />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.45, color: 'var(--muted)', textAlign: 'center' }}>
            Log a session and this shows the muscles you worked, your last session and your records.
          </p>
        </SummaryCard>
      ) : (
        <>
          <RecentWorkouts workouts={recent} error={recentError} onRetry={() => setAttempt(n => n + 1)} />

          {!undecided && (
            <>
              <MuscleBalance
                workouts={weeklyWorkouts}
                withMap
                sex={user?.personal?.sex}
                action={<span style={{ fontSize: 13, color: 'var(--muted)' }}>Last 7 days</span>}
              />

              <PersonalRecords period={30} />
            </>
          )}
        </>
      )}

      <TrainingRecap period={7} workoutCount={weeklyWorkouts.length} />

      <SummaryCard title="More">
        <ul style={{ listStyle: 'none', margin: '-6px 0 -8px', padding: 0 }}>
          {more.map(({ href, label, value, Icon }, i) => (
            <li key={href} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <Link
                href={href}
                style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 52, color: 'var(--ink)', textDecoration: 'none' }}
              >
                <span style={{ color: 'var(--muted)', display: 'grid' }}><Icon size={22} /></span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{label}</span>
                {value && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{value}</span>}
                <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </SummaryCard>
    </div>
  )
}
