'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import SummaryCard from '@/components/dashboard/SummaryCard'
import RunCard, { RunRowsSkeleton, formatKey } from '@/components/running/RunCard'
import RunDetailsSheet from '@/components/running/RunDetailsSheet'
import { getRunHistory } from '@/lib/api'
import { dayKey } from '@/lib/day'
import type { RunLog } from '@/types/running'

type Period = '30' | '60' | '90'

const PERIODS: { value: Period; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
]

interface MonthGroup {
  key: string
  label: string
  runs: RunLog[]
  totalKm: number
}

/** Runs (newest first) grouped by Singapore calendar month. */
function groupByMonth(runs: RunLog[]): MonthGroup[] {
  const thisYear = dayKey().slice(0, 4)
  const months: MonthGroup[] = []
  for (const run of runs) {
    const key = dayKey(new Date(run.run_date)).slice(0, 7)
    let group = months.find(m => m.key === key)
    if (!group) {
      group = {
        key,
        label: formatKey(`${key}-01`, key.startsWith(thisYear) ? { month: 'long' } : { month: 'long', year: 'numeric' }),
        runs: [],
        totalKm: 0,
      }
      months.push(group)
    }
    group.runs.push(run)
    group.totalKm += run.distance_meters / 1000
  }
  return months
}

export default function RunHistoryPage() {
  const [runs, setRuns] = useState<RunLog[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [days, setDays] = useState<Period>('30')
  const [attempt, setAttempt] = useState(0)
  // Tapping 30/60/90 quickly can land responses out of order — only the newest
  // request is allowed to write.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setFailed(false)
    getRunHistory(Number(days))
      .then(data => { if (requestIdRef.current === requestId) setRuns(data) })
      .catch(() => { if (requestIdRef.current === requestId) { setRuns([]); setFailed(true) } })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false) })
  }, [days, attempt])

  const months = groupByMonth(runs)

  const [openRun, setOpenRun] = useState<RunLog | null>(null)
  const closeDetails = useCallback(() => setOpenRun(null), [])
  // A delete drops the row at once and Undo puts it back; a budget toggle updates it in place.
  const onListChange = useCallback((run: RunLog, removed: boolean) => {
    setRuns(prev => {
      const rest = prev.filter(r => r.id !== run.id)
      return removed ? rest : [...rest, run].sort((a, b) => new Date(b.run_date).getTime() - new Date(a.run_date).getTime())
    })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader title="All runs" back={{ href: '/running', label: 'Runs' }} />

      <Segmented label="Period" options={PERIODS} value={days} onChange={setDays} />

      {loading ? (
        <section className="card" aria-busy="true" aria-label="Loading runs">
          <RunRowsSkeleton rows={4} />
        </section>
      ) : failed ? (
        <section className="card">
          <p style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--ink)' }}>Couldn&apos;t load your runs.</p>
          <button type="button" className="btn-secondary" onClick={() => setAttempt(a => a + 1)}>Try again</button>
        </section>
      ) : months.length === 0 ? (
        <section className="card">
          <p style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--muted)' }}>No runs in the last {days} days.</p>
          <Link href="/running?log=1" className="btn-primary" style={{ textDecoration: 'none' }}>Log a run</Link>
        </section>
      ) : (
        months.map(month => (
          <SummaryCard
            key={month.key}
            title={month.label}
            action={
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {month.totalKm.toFixed(1)} km · {month.runs.length} {month.runs.length === 1 ? 'run' : 'runs'}
              </span>
            }
          >
            <ol style={{ listStyle: 'none', margin: '-4px 0 -8px', padding: 0 }}>
              {month.runs.map((run, i) => (
                <RunCard key={run.id} run={run} first={i === 0} onOpen={setOpenRun} />
              ))}
            </ol>
          </SummaryCard>
        ))
      )}

      <RunDetailsSheet run={openRun} onClose={closeDetails} onListChange={onListChange} />
    </div>
  )
}
