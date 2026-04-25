'use client'

import { useEffect, useState } from 'react'

const RADIUS = 36
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function GoalRing({
  label,
  current,
  goal,
  unit,
  color,
}: {
  label: string
  current: number
  goal: number
  unit: string
  color: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const pct = Math.min(current / goal, 1)
  const offset = CIRCUMFERENCE * (1 - (mounted ? pct : 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: 90, height: 90 }}>
        <svg viewBox="0 0 100 100" width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="50" cy="50" r={RADIUS} fill="none"
            stroke="var(--tg-theme-hint-color)"
            strokeWidth="3" opacity="0.15"
          />
          <circle
            cx="50" cy="50" r={RADIUS} fill="none"
            stroke={color}
            strokeWidth="3" strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.85s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 1,
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '19px',
            fontWeight: 600,
            lineHeight: 1,
            color: 'var(--tg-theme-text-color)',
          }}>
            {current}
          </span>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '9px',
            color: 'var(--tg-theme-hint-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {unit}
          </span>
        </div>
      </div>

      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--tg-theme-hint-color)',
      }}>
        {label}
      </span>

      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '10px',
        color: 'var(--tg-theme-hint-color)',
        opacity: 0.6,
      }}>
        / {goal}{unit}
      </span>
    </div>
  )
}
