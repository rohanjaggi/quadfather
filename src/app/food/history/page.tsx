'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import MealCard from '@/components/food/MealCard'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { getFoodLogs } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import type { FoodLog } from '@/types/api'

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-CA')
}

function displayDate(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'

  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function FoodHistoryPage() {
  const { user } = useUser()
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d
  })
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)

  // Fast prev/next taps can land out of order — only the newest request writes.
  const requestIdRef = useRef(0)

  const fetchLogs = useCallback(async (d: Date) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const data = await getFoodLogs(formatDate(d))
      if (requestIdRef.current === requestId) setLogs(data)
    } catch {
      if (requestIdRef.current === requestId) setLogs([])
    } finally {
      if (requestIdRef.current === requestId) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs(date)
  }, [date, fetchLogs])

  function prevDay() {
    setDate(d => {
      const next = new Date(d)
      next.setDate(next.getDate() - 1)
      return next
    })
  }

  function nextDay() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    if (next > tomorrow) return
    setDate(next)
  }

  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories ?? 0),
      protein: acc.protein + (log.protein ?? 0),
      carbs: acc.carbs + (log.carbohydrates ?? 0),
      fats: acc.fats + (log.fats ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  )

  const isToday = formatDate(date) === formatDate(new Date())

  // The user's configured goals — these bars used to be scaled against
  // hard-coded 2200 kcal / 150 / 250 / 70 g.
  const goals = user?.goals

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up">
        <Link href="/food" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Food
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px',
          fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>
          History
        </h1>
      </div>

      {/* Date nav */}
      <div className="fade-up fade-up-1" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: '16px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
      }}>
        <button
          onClick={prevDay}
          style={{
            background: 'none', border: 'none', padding: '6px',
            cursor: 'pointer', color: 'var(--tg-theme-text-color)',
            borderRadius: '8px',
            transition: 'background-color 0.15s ease',
          }}
          aria-label="Previous day"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '20px',
            fontWeight: 500, color: 'var(--tg-theme-text-color)',
            display: 'block', lineHeight: 1.2,
          }}>
            {displayDate(date)}
          </span>
          {/*
            Always shown: it is the only place the year appears, and the label
            above it is either relative ("Today") or year-less ("Wed, 19 Aug").
            It used to be guarded on `displayDate(date) !== formatDate(date)`,
            comparing "Today" against "2026-08-19" — never equal, so the guard
            was dead and this line rendered regardless.
          */}
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            color: 'var(--tg-theme-hint-color)',
            letterSpacing: '0.02em',
          }}>
            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <button
          onClick={nextDay}
          disabled={isToday}
          style={{
            background: 'none', border: 'none', padding: '6px',
            cursor: isToday ? 'default' : 'pointer',
            color: 'var(--tg-theme-text-color)',
            opacity: isToday ? 0.2 : 1,
            borderRadius: '8px',
            transition: 'opacity 0.15s ease',
          }}
          aria-label="Next day"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Daily totals */}
      {!loading && logs.length > 0 && (
        <div className="fade-up fade-up-2">
          <SummaryCard title="Daily totals">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Calories prominent */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '32px',
                    fontWeight: 600, color: 'var(--tg-theme-text-color)', lineHeight: 1,
                  }}>
                    {Math.round(totals.calories)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '11px',
                    color: 'var(--tg-theme-hint-color)',
                  }}>
                    kcal
                  </span>
                </div>
                <div style={{
                  height: '4px', borderRadius: '99px',
                  backgroundColor: 'var(--tg-theme-bg-color)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: '99px',
                    width: `${goals?.daily_calorie_goal ? Math.min((totals.calories / goals.daily_calorie_goal) * 100, 100) : 0}%`,
                    backgroundColor: 'var(--accent-calories)',
                    transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
              </div>

              {/* Macro breakdown */}
              {[
                { label: 'Protein', value: Math.round(totals.protein), goal: goals?.daily_protein_goal, color: 'var(--accent-protein)' },
                { label: 'Carbs', value: Math.round(totals.carbs), goal: goals?.daily_carbs_goal, color: '#C4A55A' },
                { label: 'Fats', value: Math.round(totals.fats), goal: goals?.daily_fats_goal, color: 'var(--tg-theme-hint-color)' },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '12px',
                      fontWeight: 500, color: 'var(--tg-theme-text-color)',
                    }}>
                      {m.label}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '12px',
                      color: 'var(--tg-theme-hint-color)',
                    }}>
                      {m.value}g
                    </span>
                  </div>
                  <div style={{
                    height: '3px', borderRadius: '99px',
                    backgroundColor: 'var(--tg-theme-bg-color)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '99px',
                      width: `${m.goal ? Math.min((m.value / m.goal) * 100, 100) : 0}%`,
                      backgroundColor: m.color,
                      transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </SummaryCard>
        </div>
      )}

      {/* Meals */}
      <div className="fade-up fade-up-3">
        <SummaryCard title={
          !loading && logs.length > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Meals</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '11px',
                fontWeight: 400, color: 'var(--tg-theme-hint-color)',
                letterSpacing: '0',
                textTransform: 'none',
              }}>
                {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          ) : 'Meals'
        }>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{
                width: '20px', height: '20px', margin: '0 auto 10px',
                border: '2px solid var(--surface-border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '12px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                Loading meals
              </p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '22px',
                fontWeight: 400, color: 'var(--tg-theme-hint-color)',
                opacity: 0.6, marginBottom: '6px',
              }}>
                Nothing here
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '12px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                No meals were logged on this day
              </p>
            </div>
          ) : (
            <div>
              {logs.map((log, i) => (
                <MealCard
                  key={log.id}
                  name={log.food_name}
                  calories={Math.round(log.calories)}
                  protein={Math.round(log.protein)}
                  carbs={Math.round(log.carbohydrates)}
                  fats={Math.round(log.fats)}
                  fiber={Math.round(log.fiber ?? 0)}
                  savedFoodId={log.saved_food_id}
                  isLast={i === logs.length - 1}
                />
              ))}
            </div>
          )}
        </SummaryCard>
      </div>

    </div>
  )
}
