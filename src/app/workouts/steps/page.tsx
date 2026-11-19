'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSteps } from '@/lib/api'
import type { StepLog } from '@/types/workouts'
import { useUser } from '@/context/UserContext'
import { addDays, dayKey } from '@/lib/day'
import { formatInt } from '@/lib/format'
import { currentStepStreak, longestStepStreak } from '@/lib/streak'
import PageHeader from '@/components/ui/PageHeader'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { StepBlocks } from '@/components/ui/MetricMinis'
import { CheckIcon } from '@/components/ui/icons'
import { useGoalSweep } from '@/components/ui/useGoalSweep'

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

const keyDate = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })

const CHART_H = 128
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function StepsPage() {
  const { user, summary, todaySteps } = useUser()
  const [rows, setRows] = useState<{ date: string; steps: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const today = dayKey()
  const [selected, setSelected] = useState(today)

  const goal = user?.goals.daily_step_goal ?? 10000

  useEffect(() => {
    setLoading(true)
    setFailed(false)
    getSteps(30)
      .then((data: StepLog[]) => setRows(data.map(s => ({ date: utcDateKey(s.date), steps: s.steps })).filter(r => r.date)))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [attempt])

  const byKey = new Map(rows.map(r => [r.date, r.steps]))
  // Two sources (this page's fetch, the context's last refresh); the count only
  // grows through the day, so the fresher one is the larger.
  const stepsToday = Math.max(byKey.get(today) ?? 0, todaySteps)
  const reached = goal > 0 && stepsToday >= goal
  const sweep = useGoalSweep(reached)
  const extra = summary?.steps.extra_allowance ?? 0

  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i - 6)
    return { key, steps: key === today ? stepsToday : byKey.get(key) ?? 0 }
  })
  const max = Math.max(goal * 1.15, ...week.map(d => d.steps))
  const picked = week.find(d => d.key === selected) ?? week[6]

  const streak = currentStepStreak(rows, goal, today)
  const longest = longestStepStreak(rows, goal)
  const total = rows.reduce((s, r) => s + r.steps, 0)
  const atGoal = rows.filter(r => r.steps >= goal).length

  const neverSynced = !loading && !failed && rows.length === 0 && todaySteps === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader title="Steps" back={{ href: '/workouts', label: 'Training' }} />

      {neverSynced ? (
        <section className="card">
          <h2 className="card-title" style={{ margin: '0 0 6px' }}>No steps yet</h2>
          <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.45, color: 'var(--muted)' }}>
            Steps come from your iPhone through a Shortcut. Set it up once in Settings and they arrive on their own.
          </p>
          <Link href="/profile/steps-sync" className="btn-primary" style={{ textDecoration: 'none' }}>Set up steps sync</Link>
        </section>
      ) : (
        <>
          {/* Today */}
          <section className="card">
            <h2 className="card-title" style={{ margin: '0 0 10px' }}>Today</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <p
                  className={sweep ? 'gradient-sweep' : undefined}
                  style={{ display: 'inline-block', margin: 0, fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}
                >
                  {formatInt(stepsToday)}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--muted)' }}>
                  {reached ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--good)', display: 'grid' }}><CheckIcon size={17} /></span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Goal reached</span>
                      <span>· {formatInt(goal)}</span>
                    </span>
                  ) : (
                    <>of {formatInt(goal)} steps · <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatInt(goal - stepsToday)}</span> to go</>
                  )}
                </p>
              </div>
              {/* The hero number is right beside it, so no caption. */}
              <div style={{ flexShrink: 0 }}>
                <StepBlocks steps={stepsToday} goal={goal} caption={false} />
              </div>
            </div>
            <p style={{ margin: '16px 0 0', paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: 15, color: 'var(--ink)' }}>
              {extra > 0
                ? <><span style={{ fontWeight: 600 }}>+{formatInt(extra)} kcal</span> added to today&apos;s food budget for the extra walking.</>
                : <span style={{ color: 'var(--muted)' }}>Walk more than your usual day and the extra goes into today&apos;s food budget.</span>}
            </p>
          </section>

          {/* Week */}
          <SummaryCard
            title="This week"
            action={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <span aria-hidden="true" style={{ width: 14, borderTop: '1.5px dashed var(--muted)' }} />
                Goal {formatInt(goal)}
              </span>
            }
          >
            {loading ? (
              <div aria-hidden="true" style={{ height: CHART_H + 50, borderRadius: 12, background: 'var(--track)' }} />
            ) : failed ? (
              <div>
                <p style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--ink)' }}>Couldn&apos;t load your steps.</p>
                <button type="button" className="btn-secondary" onClick={() => setAttempt(a => a + 1)}>Try again</button>
              </div>
            ) : (
              <>
                <p style={{ margin: '-6px 0 14px', fontSize: 15, color: 'var(--muted)' }} aria-live="polite">
                  {picked.key === today ? 'Today' : keyDate(picked.key, { weekday: 'long', day: 'numeric', month: 'short' })}
                  {' · '}<span style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatInt(picked.steps)}</span> steps
                </p>
                <div style={{ position: 'relative' }}>
                  {/* Goal line */}
                  <div aria-hidden="true" style={{
                    position: 'absolute', left: 0, right: 0, top: CHART_H * (1 - goal / max),
                    borderTop: '1.5px dashed var(--muted)', opacity: 0.6, pointerEvents: 'none',
                  }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {week.map(d => {
                      const on = d.key === picked.key
                      const h = d.steps > 0 ? Math.max(4, (d.steps / max) * CHART_H) : 3
                      const day = keyDate(d.key, { weekday: 'short' })
                      return (
                        <button
                          key={d.key}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${d.key === today ? 'Today' : keyDate(d.key, { weekday: 'long', day: 'numeric', month: 'long' })}: ${formatInt(d.steps)} steps${d.steps >= goal ? ', goal reached' : ''}`}
                          onClick={() => setSelected(d.key)}
                          style={{
                            flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'transparent',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                          }}
                        >
                          <span style={{ height: CHART_H, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                            <span style={{
                              width: 22, height: h, borderRadius: '6px 6px 3px 3px',
                              background: d.steps > 0 ? 'var(--m-steps)' : 'var(--track)',
                              opacity: on || d.steps === 0 ? 1 : 0.7,
                              transition: 'height 0.6s var(--ease-out-expo), opacity 0.2s ease',
                            }} />
                          </span>
                          <span style={{ marginTop: 8, minHeight: 28, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: on ? 700 : 500, color: on ? 'var(--ink)' : 'var(--muted)' }}>
                            {day}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <p style={{ margin: '12px 0 0', paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 15, color: 'var(--ink)' }}>
                  {streak > 0 ? <><span style={{ fontWeight: 600 }}>{plural(streak, 'day')}</span> in a row at goal</> : 'No streak going right now'}
                  {longest > 0 && <span style={{ color: 'var(--muted)' }}> · longest {plural(longest, 'day')} in the last 30</span>}
                </p>
              </>
            )}
          </SummaryCard>

          {/* Last 30 days */}
          {!loading && !failed && rows.length > 0 && (
            <SummaryCard title="Last 30 days">
              {[
                ['Daily average', formatInt(total / rows.length)],
                ['Best day', formatInt(Math.max(...rows.map(r => r.steps)))],
                ['Days at goal', `${atGoal} of ${rows.length}`],
              ].map(([label, value], i) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                  padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none', margin: i === 0 ? '-6px 0 0' : 0,
                }}>
                  <span style={{ fontSize: 15, color: 'var(--muted)' }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
                </div>
              ))}
            </SummaryCard>
          )}
        </>
      )}

    </div>
  )
}
