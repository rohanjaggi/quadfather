'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { getWorkoutPRs, type WorkoutPR } from '@/lib/api'
import { prDisplayDate, prDisplayValue, prTypeLabel } from './pr-display'

interface Props {
  period: 7 | 30
}

export default function PersonalRecords({ period }: Props) {
  const [prs, setPrs] = useState<WorkoutPR[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getWorkoutPRs(period)
      .then(data => setPrs(data.prs))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  const displayPrs = prs.slice(0, 3)

  return (
    <SummaryCard title={
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Personal Records</span>
        <Link href="/workouts/prs" style={{
          fontFamily: 'var(--font-display)', fontSize: '11px',
          fontWeight: 500, color: 'var(--accent)', textDecoration: 'none',
          textTransform: 'none', letterSpacing: 'normal',
        }}>
          View history
        </Link>
      </div>
    }>
      {loading ? (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0',
        }}>
          Loading...
        </p>
      ) : prs.length === 0 ? (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0',
        }}>
          No new PRs this period
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayPrs.map((pr, i) => (
            <div key={`${pr.exercise_name}-${i}`}>
              {i > 0 && <div style={{ height: '1px', backgroundColor: 'var(--surface-border)', marginBottom: '12px' }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0, marginRight: '12px' }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '14px',
                    fontWeight: 500, color: 'var(--tg-theme-text-color)', margin: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {pr.exercise_name}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '11px',
                    color: 'var(--tg-theme-hint-color)', margin: '2px 0 0 0',
                  }}>
                    {prDisplayDate(pr, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {/* `value` is now pre-formatted ("100kg × 5") — keep it intact. */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '16px',
                    fontWeight: 600, color: 'var(--accent)',
                  }}>
                    {prDisplayValue(pr)}
                  </span>
                  <span style={{
                    display: 'block', fontFamily: 'var(--font-display)', fontSize: '9px',
                    fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--accent)', opacity: 0.7, marginTop: '2px',
                  }}>
                    {prTypeLabel(pr)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SummaryCard>
  )
}
