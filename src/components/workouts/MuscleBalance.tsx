'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { WorkoutLog } from '@/types/workouts'
import type { BalanceRatio } from '@/lib/muscle-balance'
import type { MuscleZone } from '@/lib/muscle-zones'
import { calculateMuscleIntensities } from '@/lib/muscle-intensity'
import SummaryCard from '@/components/dashboard/SummaryCard'
import MuscleMap from './MuscleMap'

interface Props {
  workouts: WorkoutLog[]
  /** Draws the muscle map above the ratios (the Training tab); Trends has its own map. */
  withMap?: boolean
  sex?: string
  /** Optional right-hand note in the title row, e.g. "Last 7 days". */
  action?: ReactNode
}

/** "Anterior : Posterior" is the lib's wording; people say front and back. */
const PLAIN: Record<string, string> = { Anterior: 'Front', Posterior: 'Back' }
const plain = (n: string) => PLAIN[n] ?? n

const STATUS_WORD: Record<BalanceRatio['status'], string> = {
  balanced: 'Even',
  skewed: 'Leaning',
  imbalanced: 'Uneven',
}

/** One plain sentence for the most lopsided pair, or "evenly spread". */
function caption(ratios: BalanceRatio[]): string {
  const off = ratios
    .filter(r => r.status !== 'balanced' && (r.left.value > 0 || r.right.value > 0))
    .sort((a, b) => Math.abs(b.leftPct - 50) - Math.abs(a.leftPct - 50))[0]
  if (!off) return 'Evenly spread across push and pull, upper and lower, front and back.'
  const [more, less, pct] = off.leftPct > 50
    ? [off.left.name, off.right.name, off.leftPct]
    : [off.right.name, off.left.name, off.rightPct]
  const tail = ratios.filter(r => r.status === 'imbalanced').length > 1 ? ' Other pairs are uneven too.' : ''
  return `More ${plain(more).toLowerCase()} than ${plain(less).toLowerCase()} work: ${pct}% to ${100 - pct}%.${tail}`
}

export default function MuscleBalance({ workouts, withMap = false, sex, action }: Props) {
  // `muscle-balance` pulls in the ~100 KB exercise→muscle table, so it is
  // code-split and loaded when this card actually has workouts to score.
  const [ratios, setRatios] = useState<BalanceRatio[]>([])
  const [intensities, setIntensities] = useState<Record<MuscleZone, number>>({} as Record<MuscleZone, number>)

  useEffect(() => {
    let cancelled = false
    if (workouts.length === 0) {
      setRatios([])
      setIntensities({} as Record<MuscleZone, number>)
      return
    }
    import('@/lib/muscle-balance')
      .then(({ calculateMuscleBalance }) => {
        if (!cancelled) setRatios(calculateMuscleBalance(workouts))
      })
      .catch(err => console.error('Failed to compute muscle balance:', err))
    if (withMap) {
      calculateMuscleIntensities(workouts.flatMap(w => w.exercises))
        .then(result => { if (!cancelled) setIntensities(result) })
        .catch(err => console.error('Failed to compute muscle intensities:', err))
    }
    return () => { cancelled = true }
  }, [workouts, withMap])

  const hasData = ratios.some(r => r.left.value > 0 || r.right.value > 0)
  const hasMap = withMap && Object.keys(intensities).length > 0

  if (!hasData && !hasMap) {
    return (
      <SummaryCard title="Muscle balance" action={action}>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
          {workouts.length === 0
            ? 'Log a session and you’ll see which muscles it worked.'
            : 'These sessions have no weighted sets to compare yet.'}
        </p>
      </SummaryCard>
    )
  }

  return (
    <SummaryCard title="Muscle balance" action={action}>
      {hasMap && <MuscleMap intensities={intensities} size="sm" sex={sex} />}
      {hasData && (
        <>
          <p style={{ margin: hasMap ? '6px 0 14px' : '0 0 14px', fontSize: 15, lineHeight: 1.45, color: 'var(--ink)' }}>
            {caption(ratios)}
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ratios.map(r => (
              <li key={r.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, fontSize: 13, color: 'var(--muted)' }}>
                  <span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{plain(r.left.name)}</span> {r.leftPct}%</span>
                  <span style={{ color: r.status === 'imbalanced' ? 'var(--over)' : 'var(--muted)', fontWeight: r.status === 'balanced' ? 400 : 600 }}>
                    {STATUS_WORD[r.status]}
                  </span>
                  <span>{r.rightPct}% <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{plain(r.right.name)}</span></span>
                </div>
                <div
                  role="img"
                  aria-label={`${plain(r.left.name)} ${r.leftPct}%, ${plain(r.right.name)} ${r.rightPct}%: ${STATUS_WORD[r.status].toLowerCase()}`}
                  style={{ position: 'relative', display: 'flex', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden' }}
                >
                  <div style={{ flex: r.leftPct, background: 'var(--m-fats)', transition: 'flex 0.5s var(--ease-out-expo)' }} />
                  <div style={{ flex: r.rightPct, background: 'var(--m-water)', transition: 'flex 0.5s var(--ease-out-expo)' }} />
                  {/* Where "even" sits, so the eye can judge the split. */}
                  <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, marginLeft: -1, background: 'var(--card)' }} />
                </div>
              </li>
            ))}
          </ul>
          {workouts.length < 3 && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              A few more sessions will make this fairer.
            </p>
          )}
        </>
      )}
    </SummaryCard>
  )
}
