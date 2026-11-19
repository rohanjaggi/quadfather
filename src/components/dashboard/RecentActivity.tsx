'use client'

import { useEffect, useRef, useState } from 'react'
import { formatTime } from '@/lib/format'
import type { FoodLog, WaterLog } from '@/types/api'
import type { WorkoutLog } from '@/types/workouts'

interface ActivityItem {
  id: string
  label: string
  detail: string
  time: string
  timestamp: number
}

function mergeActivity(foodLogs: FoodLog[], waterLogs: WaterLog[], workoutLogs: WorkoutLog[]): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const log of foodLogs) {
    items.push({
      id: `food-${log.id}`,
      label: log.food_name,
      detail: `${Math.round(log.calories)} kcal`,
      time: formatTime(log.logged_at),
      timestamp: new Date(log.logged_at).getTime(),
    })
  }

  for (const log of waterLogs) {
    items.push({
      id: `water-${log.id}`,
      label: 'Water',
      detail: `${log.amount_liters.toFixed(1)} L`,
      time: formatTime(log.logged_at),
      timestamp: new Date(log.logged_at).getTime(),
    })
  }

  for (const log of workoutLogs) {
    const n = log.exercises.length
    items.push({
      id: `workout-${log.id}`,
      label: log.name,
      detail: `${n} exercise${n !== 1 ? 's' : ''}`,
      time: formatTime(log.logged_at),
      timestamp: new Date(log.logged_at).getTime(),
    })
  }

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8)
}

/**
 * Today's log. A row that appears after the first render (i.e. the user just
 * logged it) plays the landing wash once.
 */
export default function RecentActivity({
  foodLogs,
  waterLogs,
  workoutLogs = [],
}: {
  foodLogs: FoodLog[]
  waterLogs: WaterLog[]
  workoutLogs?: WorkoutLog[]
}) {
  const items = mergeActivity(foodLogs, waterLogs, workoutLogs)
  const seen = useRef<Set<string> | null>(null)
  const [landed, setLanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const ids = items.map(i => i.id)
    if (seen.current === null) { seen.current = new Set(ids); return }
    const fresh = ids.filter(id => !seen.current!.has(id))
    ids.forEach(id => seen.current!.add(id))
    if (fresh.length === 0) return
    setLanded(new Set(fresh))
    const t = setTimeout(() => setLanded(new Set()), 2000)
    return () => clearTimeout(t)
  }, [items.map(i => i.id).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card" aria-labelledby="today-log">
      <h2 id="today-log" className="card-title" style={{ margin: '0 0 6px' }}>Today&apos;s log</h2>
      {items.length === 0 ? (
        <p style={{ margin: '6px 0 2px', fontSize: 15, color: 'var(--muted)' }}>
          Nothing yet. Your first meal starts the day.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item, i) => (
            <li
              key={item.id}
              className={landed.has(item.id) ? 'row-landed' : undefined}
              style={{
                display: 'grid', gridTemplateColumns: '52px 1fr auto', alignItems: 'baseline',
                padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none',
              }}
            >
              <time style={{ fontSize: 14, color: 'var(--muted)' }}>{item.time}</time>
              <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{item.label}</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{item.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
