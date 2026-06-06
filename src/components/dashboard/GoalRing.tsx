'use client'

import { useEffect, useState } from 'react'

const RADIUS = 34
const STROKE = 5.5
const SIZE = (RADIUS + STROKE) * 2
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
            stroke="var(--tg-theme-hint-color)"
            strokeWidth={STROKE} opacity="0.1"
          />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
            stroke={color}
            strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: '18px',
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--tg-theme-text-color)',
            letterSpacing: '-0.02em',
          }}>
            {Number.isInteger(current) ? current : +current.toFixed(1)}
          </span>
          <span style={{
            fontSize: '9px',
            fontWeight: 500,
            color: 'var(--tg-theme-hint-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: '2px',
          }}>
            {unit}
          </span>
        </div>
      </div>

      <span style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--tg-theme-text-color)',
      }}>
        {label}
      </span>

      <span style={{
        fontSize: '12px',
        fontWeight: 400,
        color: 'var(--tg-theme-hint-color)',
        opacity: 0.75,
      }}>
        / {goal}{unit}
      </span>
    </div>
  )
}
