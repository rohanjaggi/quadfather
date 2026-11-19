'use client'

import { formatInt } from '@/lib/format'
import { fillRatio, goalState } from '@/components/ui/goal'
import { useGoalSweep } from '@/components/ui/useGoalSweep'

/**
 * A labelled goal line: "Calories   1,460 / 2,400". Under goal it fills with
 * the metric tint; at goal the value plays one gradient sweep and gets a
 * check; over a goal where that's bad (calories, carbs, fats) the bar turns
 * brick and says how far over.
 */
export default function ProgressLine({
  label,
  value,
  goal,
  unit = '',
  color,
  overIsBad = false,
  decimals = 0,
}: {
  label: string
  value: number
  goal: number
  unit?: string
  color: string
  overIsBad?: boolean
  decimals?: number
}) {
  const state = goalState(value, goal, overIsBad)
  const sweep = useGoalSweep(state === 'at')
  const fmt = (n: number) => (decimals > 0 ? n.toFixed(decimals) : formatInt(n))
  const over = value - goal

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <span style={{ fontSize: 15, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>
          <span
            className={sweep ? 'gradient-sweep' : undefined}
            style={{ fontSize: 16, fontWeight: 600, color: state === 'over' ? 'var(--over)' : 'var(--ink)' }}
          >
            {fmt(value)}
          </span>
          {' '}/ {fmt(goal)}{unit && ` ${unit}`}
          {state === 'over' && <span style={{ color: 'var(--over)', fontWeight: 500 }}> · {fmt(over)} over</span>}
          {state === 'at' && <span style={{ color: 'var(--good)', fontWeight: 600 }}> · done</span>}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${fmt(value)} of ${fmt(goal)}${unit ? ` ${unit}` : ''}${state === 'over' ? `, ${fmt(over)} over` : ''}`}
        style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--track)', overflow: 'hidden' }}
      >
        <div style={{
          position: 'absolute', inset: '0 auto 0 0',
          width: `${fillRatio(value, goal) * 100}%`,
          borderRadius: 3,
          background: state === 'over' ? 'var(--over)' : color,
          transition: 'width 0.8s var(--ease-out-expo), background-color 0.3s ease',
        }} />
      </div>
    </div>
  )
}
