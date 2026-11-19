'use client'

import Link from 'next/link'
import { goalState } from '@/components/ui/goal'
import { useGoalSweep } from '@/components/ui/useGoalSweep'

/** 1dp normally, 2dp when a custom amount (e.g. 0.25 L) would round away. */
export function formatLiters(liters: number): string {
  const tenths = liters * 10
  return Math.abs(tenths - Math.round(tenths)) < 1e-6 ? liters.toFixed(1) : liters.toFixed(2)
}

// shortcut: past 12 bottles the row stops reading as countable bottles, so it
// shows 12 equal shares of the goal instead; revisit if goals routinely need more.
const MAX_BOTTLES = 12

/**
 * The water hero: one bottle per bottle-size share of the goal, the open one
 * filling partially, and "1.8 of 3.0 L". The litres number sweeps once when
 * the goal is reached during the session.
 */
export default function BottleCounter({ liters, goal, bottleSize }: {
  /** Real total logged today, in litres. */
  liters: number
  goal: number
  bottleSize: number
}) {
  const size = bottleSize > 0 ? bottleSize : 0.5
  const needed = Math.max(1, Math.ceil(goal / size - 1e-6))
  const count = Math.min(needed, MAX_BOTTLES)
  const perBottle = needed > MAX_BOTTLES ? goal / count : size
  // The epsilon keeps binary float error from eating a bottle (1.8 / 0.6 = 2.9999…).
  const full = Math.floor(liters / size + 1e-6)
  const sweep = useGoalSweep(goalState(liters, goal, false) === 'at')

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        role="img"
        aria-label={`${full} of ${needed} bottles`}
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: 8, padding: '6px 0 22px' }}
      >
        {Array.from({ length: count }, (_, i) => {
          const f = Math.max(0, Math.min(1, liters / perBottle - i + 1e-6))
          return (
            <span key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 10, height: 5, borderRadius: '2px 2px 0 0', background: f > 0.98 ? 'var(--m-water)' : 'var(--track)' }} />
              <span style={{ position: 'relative', width: 22, height: 52, borderRadius: 8, background: 'var(--track)', overflow: 'hidden' }}>
                <span style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, height: `${f * 100}%`,
                  background: 'var(--m-water)', transition: 'height 0.6s var(--ease-out-expo)',
                }} />
              </span>
            </span>
          )
        })}
      </div>

      <p style={{ margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 8 }}>
        <span
          className={sweep ? 'gradient-sweep' : undefined}
          style={{ fontSize: 60, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}
        >
          {formatLiters(liters)}
        </span>
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--muted)' }}>of {formatLiters(goal)} L</span>
      </p>
      <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--muted)' }}>
        {full} of {needed} bottles · {formatLiters(size)} L each ·{' '}
        <Link
          href="/profile/goals"
          aria-label="Change bottle size"
          style={{ display: 'inline-block', padding: '13px 6px', margin: '-13px -6px', color: 'var(--action)', fontWeight: 600, textDecoration: 'none' }}
        >
          Change
        </Link>
      </p>
    </div>
  )
}
