'use client'

import { useState } from 'react'
import { goalState } from '@/components/ui/goal'

export interface Bar {
  key: string
  /** Axis text under the bar; empty for no label. */
  axis: string
  /** Spoken and shown in the readout line: "Tue 18 Nov", "Mondays". */
  name: string
  value: number
  today?: boolean
}

/** Layout shared with the empty-state ghost chart in `parts.tsx`. */
export const PLOT_HEIGHT = 132
/** Space above the tallest mark (or the goal), as a multiple of it. */
export const HEADROOM = 1.08
export function barLayout(count: number) {
  const dense = count > 7
  return { gap: dense ? 2 : 8, radius: dense ? '3px 3px 1px 1px' : '6px 6px 2px 2px' }
}

/** Axis: every bar in a week; in a month, every 7th counting back from today so today is always labelled. */
export function Axis({ bars, picked = null }: { bars: Pick<Bar, 'key' | 'axis' | 'today'>[]; picked?: number | null }) {
  const dense = bars.length > 7
  return (
    <div aria-hidden="true" style={{ display: 'flex', gap: barLayout(bars.length).gap, marginTop: 6, height: 22 }}>
      {bars.map((b, i) => {
        const shown = !dense || (bars.length - 1 - i) % 7 === 0
        return (
          <div key={b.key} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            {b.today && (
              <span style={{ position: 'absolute', top: 0, left: '50%', width: 4, height: 4, marginLeft: -2, borderRadius: 2, background: 'var(--ink)' }} />
            )}
            {shown && b.axis && (
              <span style={{
                position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                fontSize: 11, lineHeight: '14px',
                fontWeight: b.today || picked === i ? 700 : 500,
                color: b.today || picked === i ? 'var(--ink)' : 'var(--muted)',
              }}>
                {b.axis}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Tappable bar chart. Each bar is a button; the picked bar's value shows in
 * the line above the chart. Goal is a dashed muted line; when over is bad, a
 * bar past it turns `--over` (and says so in its label).
 */
export default function BarChart({
  bars,
  label,
  tint,
  format,
  goal,
  goalLabel,
  overIsBad = false,
  hint = 'Tap a day to see its total',
}: {
  bars: Bar[]
  label: string
  tint: string
  format: (v: number) => string
  goal?: number
  goalLabel?: string
  overIsBad?: boolean
  hint?: string
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const sel = picked !== null ? bars[picked] : undefined
  const top = Math.max(goal ?? 0, ...bars.map(b => b.value)) * HEADROOM
  const { gap, radius } = barLayout(bars.length)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, minHeight: 24, marginBottom: 10 }}>
        <p aria-live="polite" style={{ margin: 0, fontSize: 13, color: 'var(--muted)', minWidth: 0 }}>
          {sel ? (
            <>
              {sel.name}{' '}
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginLeft: 4 }}>{format(sel.value)}</span>
            </>
          ) : hint}
        </p>
        {goal !== undefined && goal > 0 && goalLabel && (
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
            <svg width="16" height="2" aria-hidden="true"><line x1="0" y1="1" x2="16" y2="1" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
            {goalLabel}
          </p>
        )}
      </div>

      <div role="group" aria-label={label} style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap, height: PLOT_HEIGHT }}>
        {bars.map((b, i) => {
          const over = goal !== undefined && overIsBad && goalState(b.value, goal, true) === 'over'
          const pct = top > 0 ? (b.value / top) * 100 : 0
          const isPicked = picked === i
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={isPicked}
              aria-label={`${b.name}${b.today ? ' (today)' : ''}, ${format(b.value)}${over ? ', over goal' : ''}`}
              onClick={() => setPicked(isPicked ? null : i)}
              style={{
                flex: 1, minWidth: 0, height: '100%', padding: 0, border: 'none', background: 'transparent',
                display: 'flex', alignItems: 'flex-end', borderRadius: 4,
              }}
            >
              <span
                style={{
                  display: 'block', width: '100%',
                  height: b.value > 0 ? `max(${pct}%, 3px)` : 3,
                  borderRadius: radius,
                  background: b.value > 0 ? (over ? 'var(--over)' : tint) : 'var(--track)',
                  opacity: picked === null || isPicked ? 1 : 0.35,
                  transition: 'height .35s var(--ease-out-expo), opacity .2s ease',
                }}
              />
            </button>
          )
        })}
        {goal !== undefined && goal > 0 && top > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', left: 0, right: 0, bottom: `${(goal / top) * 100}%`,
              borderTop: '1.5px dashed var(--muted)', opacity: 0.7, pointerEvents: 'none',
              transition: 'bottom .35s var(--ease-out-expo)',
            }}
          />
        )}
      </div>

      <Axis bars={bars} picked={picked} />
    </div>
  )
}
