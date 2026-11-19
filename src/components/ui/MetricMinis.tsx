'use client'

import { formatInt } from '@/lib/format'
import { fillRatio, goalState } from '@/components/ui/goal'

/**
 * The three small secondary-metric forms from the approved Today layout
 * (.impeccable/mocks/today-lead-a.html). Each fits its own data, so the row
 * never repeats one graphic: macros as goal-capped columns, water as bottles,
 * steps as thousands.
 */

const capStyle: React.CSSProperties = { margin: '8px 0 0', fontSize: 13, lineHeight: 1.35, color: 'var(--muted)' }
const valStyle: React.CSSProperties = { color: 'var(--ink)', fontWeight: 600 }

export interface MacroItem {
  label: string
  value: number
  goal: number
  color: string
  overIsBad?: boolean
}

/** Mini columns, 44px tall. The rule on top is the goal; over goal, the
 *  column breaks through it in brick. */
export function MacroColumns({ items }: { items: MacroItem[] }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {items.map(m => {
        const state = goalState(m.value, m.goal, !!m.overIsBad)
        const pct = fillRatio(m.value, m.goal) * 100
        const desc = `${m.label}: ${formatInt(m.value)} of ${formatInt(m.goal)} g${state === 'over' ? `, ${formatInt(m.value - m.goal)} over` : ''}`
        return (
          <div key={m.label} role="img" aria-label={desc} style={{ width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ height: 50, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ position: 'relative', width: 12, height: 44, borderRadius: 4, background: 'var(--track)' }}>
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 4,
                  height: state === 'over' ? 'calc(100% + 6px)' : `${pct}%`,
                  background: state === 'over' ? 'var(--over)' : m.color,
                  transition: 'height 0.8s var(--ease-out-expo)',
                }} />
                <div style={{ position: 'absolute', left: -4, right: -4, top: 0, height: 1.5, borderRadius: 1, background: 'var(--muted)', opacity: 0.55 }} />
              </div>
            </div>
            <p style={capStyle} aria-hidden="true">
              {m.label}<br />
              <span style={{ ...valStyle, color: state === 'over' ? 'var(--over)' : 'var(--ink)' }}>
                {formatInt(m.value)}{state === 'over' && `/${formatInt(m.goal)}`}
              </span>
            </p>
          </div>
        )
      })}
    </div>
  )
}

// shortcut: past 8 bottles the pips stop being countable at a glance, so the
// row caps there and the caption carries the exact litres; revisit if goals
// routinely exceed 8 bottles.
const MAX_PIPS = 8

/** One pip per bottle at the user's bottle size; the open bottle fills
 *  partially. */
export function WaterPips({ liters, goalLiters, bottleSize, color = 'var(--m-water)' }: {
  liters: number
  goalLiters: number
  bottleSize: number
  color?: string
}) {
  const size = bottleSize > 0 ? bottleSize : 0.5
  const total = Math.max(1, Math.min(MAX_PIPS, Math.ceil(goalLiters / size)))
  const perPip = goalLiters / total
  const filled = perPip > 0 ? liters / perPip : 0

  return (
    <div role="img" aria-label={`Water: ${liters.toFixed(1)} of ${goalLiters.toFixed(1)} litres`}>
      <div style={{ height: 50, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {Array.from({ length: total }, (_, i) => {
          const f = Math.max(0, Math.min(1, filled - i))
          return (
            <span key={i} style={{ position: 'relative', width: 10, height: 30, borderRadius: 5, background: 'var(--track)', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${f * 100}%`, background: color, transition: 'height 0.6s var(--ease-out-expo)' }} />
            </span>
          )
        })}
      </div>
      <p style={capStyle} aria-hidden="true">
        Water<br /><span style={valStyle}>{liters.toFixed(1)}</span> / {goalLiters.toFixed(1)} L
      </p>
    </div>
  )
}

/** Ten blocks, one per tenth of the goal (one per 1,000 at the default). */
export function StepBlocks({ steps, goal, color = 'var(--m-steps)', caption = true }: { steps: number; goal: number; color?: string; caption?: boolean }) {
  const per = goal > 0 ? goal / 10 : 1000
  const filled = steps / per
  return (
    <div role="img" aria-label={`Steps: ${formatInt(steps)} of ${formatInt(goal)}`}>
      <div style={{ height: 50, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 12px)', gridTemplateRows: 'repeat(2, 19px)', gap: 5 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const f = Math.max(0, Math.min(1, filled - i))
            return (
              <span key={i} style={{ position: 'relative', borderRadius: 3, background: 'var(--track)', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${f * 100}%`, background: color, transition: 'width 0.6s var(--ease-out-expo)' }} />
              </span>
            )
          })}
        </div>
      </div>
      {caption && (
        <p style={capStyle} aria-hidden="true">
          Steps<br /><span style={valStyle}>{formatInt(steps)}</span>
        </p>
      )}
    </div>
  )
}
