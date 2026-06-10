'use client'

import { useUser } from '@/context/UserContext'

export default function BurnSummary() {
  const { runLogs } = useUser()
  const totalBurnRaw = runLogs.reduce((s, r) => s + r.calories_burned, 0)
  const credited = Math.round(totalBurnRaw * 0.5)

  if (runLogs.length === 0) return null

  return (
    <div className="card" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '4px',
        }}>
          Credited to budget
        </p>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: 500,
          color: 'var(--accent-calories)',
          lineHeight: 1,
        }}>
          +{credited}
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            color: 'var(--tg-theme-hint-color)',
            marginLeft: '4px',
          }}>
            kcal
          </span>
        </p>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '11px',
        color: 'var(--tg-theme-hint-color)',
        textAlign: 'right',
      }}>
        <p>{Math.round(totalBurnRaw)} kcal burned</p>
        <p>50% credited (conservative)</p>
      </div>
    </div>
  )
}
