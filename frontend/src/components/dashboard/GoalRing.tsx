'use client'

import { useEffect, useState } from 'react'

const RADIUS = 45
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
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
        {/* background track */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke="var(--tg-theme-hint-color)"
          strokeWidth="8"
          opacity="0.2"
        />
        {/* progress arc */}
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* centre text — counter-rotate so it reads normally */}
        <text
          x="50" y="50"
          textAnchor="middle" dominantBaseline="central"
          className="rotate-90"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: '50px 50px',
            fill: 'var(--tg-theme-text-color)',
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          {current}
        </text>
      </svg>
      <span className="text-xs font-medium" style={{ color: 'var(--tg-theme-hint-color)' }}>
        {label}
      </span>
      <span className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
        / {goal} {unit}
      </span>
    </div>
  )
}
