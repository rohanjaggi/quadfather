'use client'

import { useState } from 'react'
import BottleCounter from '@/components/water/BottleCounter'
import Link from 'next/link'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function WaterPage() {
  const { user, summary, waterLogs, logWater, deleteWater } = useUser()

  const [customOpen, setCustomOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  const totalLiters = summary?.water.total ?? 0
  const goal = user?.goals.daily_water_goal ?? 3
  const bottleSize = user?.water_bottle_size ?? 0.5
  const currentBottles = Math.round(totalLiters / bottleSize)
  const totalBottles = Math.ceil(goal / bottleSize)

  async function handleAdd() {
    await logWater({ bottles: 1 })
  }

  async function handleRemove() {
    if (waterLogs.length > 0) {
      await deleteWater(waterLogs[0].id)
    }
  }

  // Build running totals for the timeline
  const logsAsc = [...waterLogs].reverse()
  const runningTotals: number[] = []
  let acc = 0
  for (const log of logsAsc) {
    acc += log.amount_liters
    runningTotals.push(acc)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up">
        <Link href="/food" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-body)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Nutrition
        </Link>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '5px',
        }}>
          Hydration
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          fontWeight: 400,
          lineHeight: 1.1,
          color: 'var(--tg-theme-text-color)',
        }}>
          Water Intake
        </h1>
      </div>

      {/* Counter */}
      <div className="fade-up fade-up-1">
        <SummaryCard title="Today's Hydration">
          <BottleCounter
            count={currentBottles}
            goal={goal}
            bottleSize={bottleSize}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </SummaryCard>
      </div>

      {/* Custom amount */}
      <div className="fade-up fade-up-2">
        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px dashed var(--accent-water)',
              background: 'transparent',
              color: 'var(--accent-water)',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M2 12h20" />
            </svg>
            Custom Amount
          </button>
        ) : (
          <div className="card" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span className="label-caps" style={{ letterSpacing: '0.1em', marginBottom: 0 }}>
                Custom Amount
              </span>
              <button
                type="button"
                onClick={() => { setCustomOpen(false); setCustomAmount('') }}
                style={{
                  background: 'none', border: 'none', padding: '4px',
                  cursor: 'pointer', opacity: 0.4,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--tg-theme-text-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="250"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                autoFocus
                className="input-field"
                style={{
                  width: '100%',
                  fontSize: '20px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  padding: '14px 44px 14px 16px',
                }}
              />
              <span style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--tg-theme-hint-color)',
                pointerEvents: 'none',
              }}>
                ml
              </span>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!customAmount || parseFloat(customAmount) <= 0}
              onClick={async () => {
                const ml = parseFloat(customAmount)
                if (ml > 0) {
                  await logWater({ amount_liters: ml / 1000 })
                  setCustomAmount('')
                  setCustomOpen(false)
                }
              }}
              style={{
                backgroundColor: 'var(--accent-water)',
                opacity: (!customAmount || parseFloat(customAmount) <= 0) ? 0.4 : 1,
              }}
            >
              Add {customAmount ? `${customAmount}ml` : 'water'}
            </button>
          </div>
        )}
      </div>

      {/* Bottle size link */}
      <div className="fade-up fade-up-3" style={{ display: 'flex', justifyContent: 'center' }}>
        <Link
          href="/profile/goals"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--tg-theme-hint-color)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Bottle size: {bottleSize < 1 ? `${bottleSize * 1000}ml` : `${bottleSize}L`}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {/* Log timeline */}
      {waterLogs.length > 0 && (
        <div className="fade-up fade-up-4">
          <SummaryCard title="Today's Log">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {logsAsc.map((log, i) => {
                const running = runningTotals[i]
                const pct = Math.min(running / goal, 1)
                const isLast = i === logsAsc.length - 1

                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingBottom: isLast ? 0 : '12px',
                      marginBottom: isLast ? 0 : '12px',
                      borderBottom: isLast ? 'none' : '1px solid var(--surface-border)',
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      width: 8, height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-water)',
                      flexShrink: 0,
                      opacity: 0.5 + 0.5 * pct,
                    }} />

                    {/* Time */}
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      color: 'var(--tg-theme-hint-color)',
                      flexShrink: 0,
                      width: '36px',
                    }}>
                      {formatTime(log.logged_at)}
                    </span>

                    {/* Amount */}
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: 'var(--tg-theme-text-color)',
                    }}>
                      +{log.amount_liters.toFixed(2)}L
                    </span>

                    {/* Running total bar */}
                    <div style={{ flex: 1, position: 'relative', height: '2px', borderRadius: '99px', backgroundColor: 'var(--tg-theme-bg-color)' }}>
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '99px',
                        width: `${pct * 100}%`,
                        backgroundColor: 'var(--accent-water)',
                        transition: 'width 0.5s var(--ease-smooth)',
                      }} />
                    </div>

                    {/* Running total label */}
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      color: 'var(--tg-theme-hint-color)',
                      flexShrink: 0,
                    }}>
                      {running.toFixed(1)}L
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => deleteWater(log.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px',
                        cursor: 'pointer',
                        opacity: 0.3,
                        flexShrink: 0,
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="var(--tg-theme-text-color)" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </SummaryCard>
        </div>
      )}

    </div>
  )
}
