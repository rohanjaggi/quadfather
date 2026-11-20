'use client'

import { useCallback, useEffect, useState } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { getWorkoutPRs, type WorkoutPR } from '@/lib/api'
import { prDisplayDate, prDisplayValue } from './pr-display'
import { RowsSkeleton, ErrorRetry, friendlyError } from './bits'

/** No "See all": the Training tab's More list already links to Records. */
export default function PersonalRecords({ period }: { period: 7 | 30 }) {
  const [prs, setPrs] = useState<WorkoutPR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    getWorkoutPRs(period)
      .then(data => { if (!stale) setPrs(data.prs) })
      // A failed fetch used to read "No new PRs this period", which isn't true.
      .catch(err => { if (!stale) setError(friendlyError(err, 'Couldn’t load your records.')) })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [period, attempt])

  const retry = useCallback(() => setAttempt(n => n + 1), [])

  return (
    <SummaryCard title="Records">
      {loading ? (
        <RowsSkeleton rows={3} />
      ) : error ? (
        <ErrorRetry message={error} onRetry={retry} />
      ) : prs.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
          No new records {period === 7 ? 'this week' : 'in the last 30 days'}. Your heaviest sets land here.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {prs.slice(0, 3).map((pr, i) => (
            <li
              key={`${pr.exercise_name}-${i}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.exercise_name}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{prDisplayDate(pr, { day: 'numeric', month: 'short' })}</span>
              </span>
              {/* `value` is pre-formatted ("100kg × 5"): keep it whole, truncate the name instead. */}
              <span style={{ flexShrink: 0, fontSize: 16, fontWeight: 600 }}>{prDisplayValue(pr)}</span>
            </li>
          ))}
        </ol>
      )}
    </SummaryCard>
  )
}
