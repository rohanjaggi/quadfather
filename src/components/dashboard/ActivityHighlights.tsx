'use client'

import Link from 'next/link'
import { formatInt } from '@/lib/format'
import type { StepLog } from '@/types/workouts'

interface Props {
  todaySteps: number
  weeklySteps: StepLog[]
  stepGoal?: number
}

export default function ActivityHighlights({ todaySteps, weeklySteps, stepGoal: stepGoalProp }: Props) {
  const avgSteps = weeklySteps.length > 0
    ? Math.round(weeklySteps.reduce((sum, s) => sum + s.steps, 0) / weeklySteps.length)
    : 0

  const stepGoal = stepGoalProp ?? 10000
  const stepProgress = Math.min(todaySteps / stepGoal, 1)
  const remaining = Math.max(stepGoal - todaySteps, 0)

  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: '16px',
      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
      display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      {/* Steps row: today's count with inline progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.8 }}>
          <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600,
              color: 'var(--tg-theme-text-color)', letterSpacing: '-0.01em',
            }}>
              {formatInt(todaySteps)} steps
            </span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 400,
              color: 'var(--tg-theme-hint-color)',
            }}>
              / {formatInt(stepGoal)}
            </span>
          </div>
          <div style={{
            height: '3px', borderRadius: '99px',
            backgroundColor: 'var(--tg-theme-bg-color)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '99px',
              width: `${stepProgress * 100}%`,
              backgroundColor: 'var(--accent)',
              transition: 'width 0.6s var(--ease-out-expo)',
            }} />
          </div>
        </div>
      </div>

      {/* Bottom stats row */}
      <div style={{
        display: 'flex', gap: '0',
        borderTop: '1px solid var(--surface-border)',
        paddingTop: '12px',
      }}>
        <div style={{ flex: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            color: 'var(--tg-theme-hint-color)', fontWeight: 400,
          }}>
            7-day avg
          </span>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600,
            color: 'var(--tg-theme-text-color)', marginTop: '2px', letterSpacing: '-0.01em',
          }}>
            {avgSteps > 0 ? formatInt(avgSteps) : '-'}
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--tg-theme-hint-color)', marginLeft: '2px' }}>
              /day
            </span>
          </div>
        </div>

        <div style={{
          width: '1px', backgroundColor: 'var(--surface-border)',
          margin: '0 16px', alignSelf: 'stretch',
        }} />

        <div style={{ flex: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            color: 'var(--tg-theme-hint-color)', fontWeight: 400,
          }}>
            Remaining
          </span>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600,
            color: remaining === 0 ? 'var(--accent-protein)' : 'var(--tg-theme-text-color)',
            marginTop: '2px', letterSpacing: '-0.01em',
          }}>
            {remaining === 0 ? 'Goal hit' : formatInt(remaining)}
            {remaining > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--tg-theme-hint-color)', marginLeft: '2px' }}>
                to go
              </span>
            )}
          </div>
        </div>
      </div>

      {/* History link */}
      <Link href="/workouts/steps" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        borderTop: '1px solid var(--surface-border)',
        paddingTop: '10px', marginTop: '-2px',
        fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500,
        color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
      }}>
        View history
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  )
}
