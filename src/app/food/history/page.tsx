'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import ProgressLine from '@/components/ui/ProgressLine'
import MealList from '@/components/food/MealList'
import { macroLine } from '@/components/food/meals'
import { getFoodLogs } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import { addDays, dayKey } from '@/lib/day'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'
import type { FoodLog } from '@/types/api'

/** Formats a `YYYY-MM-DD` key as that calendar date, whatever the device timezone. */
function formatKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
}

function displayDate(key: string): string {
  if (key === dayKey()) return 'Today'
  if (key === addDays(dayKey(), -1)) return 'Yesterday'
  return formatKey(key, { weekday: 'long' })
}

const stepBtn: React.CSSProperties = {
  width: 44, height: 44, flexShrink: 0, border: 'none', borderRadius: 22, padding: 0,
  display: 'grid', placeItems: 'center', background: 'var(--track)', color: 'var(--ink)',
}
const caption: React.CSSProperties = { margin: 0, fontSize: 14, color: 'var(--muted)' }

export default function FoodHistoryPage() {
  const { user, deleteFood } = useUser()
  const [date, setDate] = useState(() => addDays(dayKey(), -1))
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const dateRef = useRef(date)
  dateRef.current = date

  // Fast prev/next taps can land out of order — only the newest request writes.
  const requestIdRef = useRef(0)

  const fetchLogs = useCallback(async (d: string) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setFailed(false)
    try {
      const data = await getFoodLogs(d)
      if (requestIdRef.current === requestId) setLogs(data)
    } catch {
      if (requestIdRef.current === requestId) { setLogs([]); setFailed(true) }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs(date)
  }, [date, fetchLogs])

  // The row leaves at once; Undo puts it back, unless the user has paged to another day since.
  function handleDelete(id: number) {
    const log = logs.find(l => l.id === id)
    const day = date
    setLogs(prev => prev.filter(l => l.id !== id))
    // Undo, or a server delete that fails, both put the row back.
    const restore = () => {
      if (log && dateRef.current === day) setLogs(prev => (prev.some(l => l.id === id) ? prev : [...prev, log]))
    }
    return deleteFood(id, { onUndo: restore, onFail: restore })
  }

  function prevDay() {
    setDate(d => addDays(d, -1))
  }

  function nextDay() {
    const next = addDays(date, 1)
    if (next > dayKey()) return
    setDate(next)
  }

  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories ?? 0),
      protein: acc.protein + (log.protein ?? 0),
      carbohydrates: acc.carbohydrates + (log.carbohydrates ?? 0),
      fats: acc.fats + (log.fats ?? 0),
    }),
    { calories: 0, protein: 0, carbohydrates: 0, fats: 0 },
  )

  const isToday = date === dayKey()

  return (
    <div>
      <PageHeader title="Past days" back={{ href: '/food', label: 'Food' }} />

      <section className="card" aria-busy={loading}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button type="button" onClick={prevDay} aria-label="Previous day" style={stepBtn}>
            <ChevronLeftIcon size={20} />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>{displayDate(date)}</h2>
            {/* The only place the year appears; the line above is relative or a weekday. */}
            <p style={{ ...caption, fontSize: 13, marginTop: 2 }}>{formatKey(date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <button
            type="button"
            onClick={nextDay}
            disabled={isToday}
            aria-label="Next day"
            style={{ ...stepBtn, opacity: isToday ? 0.35 : 1, cursor: isToday ? 'default' : 'pointer' }}
          >
            <ChevronRightIcon size={20} />
          </button>
        </div>

        {loading ? (
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ height: 34, borderRadius: 8, background: 'var(--track)' }} />
            {[0, 1, 2].map(i => <div key={i} style={{ height: 48, borderRadius: 10, background: 'var(--track)', opacity: 0.7 }} />)}
          </div>
        ) : failed ? (
          <div>
            <p role="alert" style={caption}>Couldn&apos;t load this day.</p>
            <button type="button" className="btn-secondary" onClick={() => fetchLogs(date)} style={{ marginTop: 12 }}>Try again</button>
          </div>
        ) : logs.length === 0 ? (
          <div>
            <p style={caption}>Nothing was logged on this day.</p>
            <button type="button" className="btn-secondary" onClick={prevDay} style={{ marginTop: 12 }}>Go back a day</button>
          </div>
        ) : (
          <>
            {/* Keyed by day so paging between days never plays the goal sweep. */}
            <ProgressLine
              key={date}
              label="Calories"
              value={totals.calories}
              goal={user?.goals.daily_calorie_goal ?? 0}
              unit="kcal"
              color="var(--m-calories)"
              overIsBad
            />
            <p style={{ ...caption, fontSize: 13, margin: '8px 0 16px' }}>{macroLine(totals)}</p>
            <MealList logs={logs} onDelete={handleDelete} />
          </>
        )}
      </section>
    </div>
  )
}
