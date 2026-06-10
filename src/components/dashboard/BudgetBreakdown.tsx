'use client'

import type { BudgetBreakdown as BudgetType } from '@/types/api'

export default function BudgetBreakdown({ budget, consumed }: { budget: BudgetType; consumed: number }) {
  const hasExercise = budget.runs_credit > 0 || budget.workouts_credit > 0 || budget.steps_credit > 0

  if (!hasExercise) return null

  const remaining = budget.total - consumed

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '18px',
      borderRadius: '16px',
      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
    }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--tg-theme-hint-color)',
      }}>
        Today&apos;s Budget
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <BudgetRow label="Base goal" value={budget.base} />
        {budget.runs_credit > 0 && (
          <BudgetRow
            label="Running"
            value={budget.runs_credit}
            prefix="+"
            hint={`${budget.runs_raw} raw`}
            color="var(--accent-calories)"
          />
        )}
        {budget.workouts_credit > 0 && (
          <BudgetRow
            label="Workout"
            value={budget.workouts_credit}
            prefix="+"
            hint={`${budget.workouts_raw} raw`}
            color="var(--accent)"
          />
        )}
        {budget.steps_credit > 0 && (
          <BudgetRow
            label="Extra steps"
            value={budget.steps_credit}
            prefix="+"
            color="var(--accent-steps)"
          />
        )}
      </div>

      <div style={{
        borderTop: '1px solid var(--surface-border)',
        paddingTop: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--tg-theme-text-color)',
        }}>
          Remaining
        </span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 600,
          color: remaining >= 0 ? 'var(--accent-protein)' : 'var(--accent-calories)',
          letterSpacing: '-0.02em',
        }}>
          {remaining >= 0 ? '' : '−'}{Math.abs(Math.round(remaining))}
          <span style={{
            fontSize: '11px',
            fontWeight: 400,
            color: 'var(--tg-theme-hint-color)',
            marginLeft: '3px',
          }}>
            kcal
          </span>
        </span>
      </div>
    </div>
  )
}

function BudgetRow({
  label,
  value,
  prefix,
  hint,
  color,
}: {
  label: string
  value: number
  prefix?: string
  hint?: string
  color?: string
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '13px',
        fontWeight: 400,
        color: 'var(--tg-theme-hint-color)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '13px',
        fontWeight: 500,
        color: color ?? 'var(--tg-theme-text-color)',
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
      }}>
        {prefix}{Math.round(value)}
        {hint && (
          <span style={{
            fontSize: '10px',
            fontWeight: 400,
            color: 'var(--tg-theme-hint-color)',
            opacity: 0.7,
          }}>
            ({hint})
          </span>
        )}
      </span>
    </div>
  )
}
