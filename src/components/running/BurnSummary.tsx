'use client'

import { useUser } from '@/context/UserContext'

export default function BurnSummary() {
  const { runLogs } = useUser()
  const toggledRuns = runLogs.filter(r => r.added_to_allowance)
  const totalBurn = toggledRuns.reduce((s, r) => s + r.calories_burned, 0)

  if (runLogs.length === 0) return null

  return (
    <div className="card" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '4px',
        }}>
          Calories earned
        </p>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: 500,
          color: 'var(--accent-calories)',
          lineHeight: 1,
        }}>
          +{Math.round(totalBurn)}
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--tg-theme-hint-color)',
            marginLeft: '4px',
          }}>
            kcal
          </span>
        </p>
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        color: 'var(--tg-theme-hint-color)',
        textAlign: 'right',
      }}>
        <p>{toggledRuns.length} run{toggledRuns.length !== 1 ? 's' : ''} added</p>
        <p>to daily allowance</p>
      </div>
    </div>
  )
}
