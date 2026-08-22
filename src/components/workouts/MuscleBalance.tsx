'use client'

import { useEffect, useState } from 'react'
import type { WorkoutLog } from '@/types/workouts'
import type { BalanceRatio } from '@/lib/muscle-balance'
import SummaryCard from '@/components/dashboard/SummaryCard'

interface Props {
  workouts: WorkoutLog[]
}

const STATUS_COLORS: Record<BalanceRatio['status'], string> = {
  balanced: '#22c55e',
  skewed: '#eab308',
  imbalanced: '#ef4444',
}

export default function MuscleBalance({ workouts }: Props) {
  // `muscle-balance` pulls in the ~100 KB exercise→muscle table, so it is
  // code-split and loaded when this card actually has workouts to score.
  const [ratios, setRatios] = useState<BalanceRatio[]>([])

  useEffect(() => {
    let cancelled = false
    if (workouts.length === 0) {
      setRatios([])
      return
    }
    import('@/lib/muscle-balance')
      .then(({ calculateMuscleBalance }) => {
        if (!cancelled) setRatios(calculateMuscleBalance(workouts))
      })
      .catch(err => console.error('Failed to compute muscle balance:', err))
    return () => { cancelled = true }
  }, [workouts])

  const hasData = ratios.some(r => r.left.value > 0 || r.right.value > 0)

  if (!hasData) {
    return (
      <SummaryCard title="Muscle Balance">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0',
        }}>
          No data to calculate balance
        </p>
      </SummaryCard>
    )
  }

  return (
    <SummaryCard title="Muscle Balance">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {ratios.map(ratio => (
          <div key={ratio.label}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: '6px',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '11px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                {ratio.left.name} {ratio.leftPct}%
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '11px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                {ratio.rightPct}% {ratio.right.name}
              </span>
            </div>
            <div style={{
              display: 'flex', height: '8px', borderRadius: '99px',
              overflow: 'hidden', gap: '2px',
            }}>
              <div style={{
                flex: ratio.leftPct,
                backgroundColor: STATUS_COLORS[ratio.status],
                borderRadius: '99px 0 0 99px',
                transition: 'flex 0.5s var(--ease-smooth)',
              }} />
              <div style={{
                flex: ratio.rightPct,
                backgroundColor: STATUS_COLORS[ratio.status],
                opacity: 0.4,
                borderRadius: '0 99px 99px 0',
                transition: 'flex 0.5s var(--ease-smooth)',
              }} />
            </div>
          </div>
        ))}
        {workouts.length < 3 && (
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            color: 'var(--tg-theme-hint-color)', textAlign: 'center', fontStyle: 'italic',
          }}>
            Log more sessions for reliable balance data
          </p>
        )}
      </div>
    </SummaryCard>
  )
}
