'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getRunningAnalytics } from '@/lib/api'
import { formatInt, formatPace } from '@/lib/format'
import { addDays, dayKey } from '@/lib/day'
import { EXERCISE_DAMPENING } from '@/lib/constants'
import { useUser } from '@/context/UserContext'
import { PlusIcon } from '@/components/ui/icons'
import { runPace } from './RunCard'
import type { RunLog, RunningAnalyticsResponse } from '@/types/running'

/**
 * "This week": distance, runs, best pace, and what the runs added to the food
 * budget, ending in the screen's one primary action. `allRunsLink` puts the
 * history link here when the page hides its empty Recent runs card.
 */
export default function ThisWeekCard({ runs, onLog, allRunsLink = false }: { runs: RunLog[] | null; onLog: () => void; allRunsLink?: boolean }) {
  const { runLogs, summary } = useUser()
  const [data, setData] = useState<RunningAnalyticsResponse | null>(null)
  const [failed, setFailed] = useState(false)

  // Refetch whenever the context's runs change (a run was logged, deleted or
  // pulled in by a Strava sync) — otherwise these totals go stale on the page.
  useEffect(() => {
    let cancelled = false
    getRunningAnalytics(7)
      .then(result => { if (!cancelled) { setData(result); setFailed(false) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [runLogs])

  const totals = data?.totals
  /**
   * What actually reached the calorie allowance. The API totals carry
   * `credited_calories`, which respects each run's own `added_to_allowance`
   * flag — the local dampening below counts runs the user excluded, so it is
   * only a fallback for servers that don't send the field yet.
   */
  const weekCredit = totals ? Math.round(totals.credited_calories ?? totals.calories * EXERCISE_DAMPENING) : 0
  const todayCredit = summary?.budget?.runs_credit ?? 0

  // Best pace over the same 7 days. Runs under 1 km are left out so a set of
  // strides doesn't pass for the week's best pace.
  const weekStart = addDays(dayKey(), -6)
  const paces = (runs ?? [])
    .filter(r => r.distance_meters >= 1000 && dayKey(new Date(r.run_date)) >= weekStart)
    .map(runPace)
    .filter((p): p is number => p != null && p > 0)
  const bestPace = paces.length ? Math.min(...paces) : undefined

  let body: React.ReactNode
  if (!data) {
    body = failed
      ? <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>Couldn&apos;t load this week&apos;s totals.</p>
      : (
        <div aria-hidden="true">
          <div style={{ width: 120, height: 44, borderRadius: 10, background: 'var(--track)' }} />
          <div style={{ width: 200, height: 14, borderRadius: 6, background: 'var(--track)', marginTop: 12 }} />
        </div>
      )
  } else if (data.totals.run_count === 0) {
    body = <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>No runs in the last 7 days.</p>
  } else {
    const n = data.totals.run_count
    body = (
      <>
        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}>
            {(data.totals.distance / 1000).toFixed(1)}
          </span>
          <span style={{ fontSize: 17, color: 'var(--muted)' }}>km</span>
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--muted)' }}>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{n}</span> {n === 1 ? 'run' : 'runs'}
          {bestPace != null && (
            <> · best pace <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{formatPace(bestPace, 'min')}</span> /km</>
          )}
        </p>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            {todayCredit > 0
              ? `+${formatInt(todayCredit)} kcal added to today's budget`
              : weekCredit > 0
                ? `+${formatInt(weekCredit)} kcal added to your food budget this week`
                : "This week's runs aren't counting toward your food budget"}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.4, color: 'var(--muted)' }}>
            {todayCredit > 0 && weekCredit > todayCredit && `${formatInt(weekCredit)} kcal across the week. `}
            Half of each run&apos;s burn counts, since trackers tend to run high.
          </p>
        </div>
      </>
    )
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h2 className="card-title" style={{ margin: 0 }}>This week</h2>
        {allRunsLink ? (
          <Link href="/running/history" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-12px 0', fontSize: 15, fontWeight: 600, color: 'var(--action)', textDecoration: 'none' }}>
            All runs
          </Link>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Last 7 days</span>
        )}
      </div>
      {body}
      <button type="button" className="btn-primary" onClick={onLog} style={{ marginTop: 18 }}>
        <PlusIcon size={20} /> Log a run
      </button>
    </section>
  )
}
