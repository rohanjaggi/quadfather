'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MealCard from '@/components/food/MealCard'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { getFoodLogs } from '@/lib/api'
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

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function FoodHistoryPage() {
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d
  })
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async (d: Date) => {
    setLoading(true)
    try {
      const data = await getFoodLogs(formatDate(d))
      setLogs(data)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
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
          Food
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px',
          fontWeight: 400, lineHeight: 1.1, color: 'var(--tg-theme-text-color)',
        }}>
          History
        </h1>
      </div>

      {/* Date nav */}
      <div className="fade-up fade-up-1" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 4px',
      }}>
        <button
          onClick={prevDay}
          style={{
            background: 'none', border: 'none', padding: '8px',
            cursor: 'pointer', color: 'var(--tg-theme-text-color)',
          }}
          aria-label="Previous day"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '18px',
          fontWeight: 500, color: 'var(--tg-theme-text-color)',
        }}>
          {displayDate(date)}
        </span>

        <button
          onClick={nextDay}
          disabled={isToday}
          style={{
            background: 'none', border: 'none', padding: '8px',
            cursor: isToday ? 'default' : 'pointer',
            color: 'var(--tg-theme-text-color)',
            opacity: isToday ? 0.25 : 1,
          }}
          aria-label="Next day"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Daily totals */}
      {!loading && logs.length > 0 && (
        <div className="fade-up fade-up-2">
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px',
          }}>
            {[
              { label: 'Cal', value: Math.round(totals.calories), color: 'var(--accent-calories)' },
              { label: 'Protein', value: Math.round(totals.protein), color: 'var(--accent-protein)' },
              { label: 'Carbs', value: Math.round(totals.carbs), color: '#C4A55A' },
              { label: 'Fats', value: Math.round(totals.fats), color: 'var(--tg-theme-hint-color)' },
            ].map(m => (
              <div key={m.label} style={{
                textAlign: 'center',
                padding: '12px 8px',
                borderRadius: '14px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '20px',
                  fontWeight: 600, color: 'var(--tg-theme-text-color)',
                  lineHeight: 1.2, marginBottom: '2px',
                }}>
                  {m.value}
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: '9px',
                  fontWeight: 500, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: m.color,
                }}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meals */}
      <div className="fade-up fade-up-3">
        <SummaryCard title="Meals">
          {loading ? (
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '13px',
              color: 'var(--tg-theme-hint-color)', textAlign: 'center',
              padding: '24px 0',
            }}>
              Loading...
            </p>
          ) : logs.length === 0 ? (
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '13px',
              color: 'var(--tg-theme-hint-color)', textAlign: 'center',
              padding: '24px 0',
            }}>
              No meals logged this day
            </p>
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
                  time={formatTime(log.logged_at)}
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
