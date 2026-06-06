'use client'

import { useState, useEffect } from 'react'
import { getWorkouts, deleteWorkout } from '@/lib/api'
import type { WorkoutLog } from '@/types/workouts'

export default function RecentWorkouts() {
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorkouts(30)
      .then(setWorkouts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: number) {
    await deleteWorkout(id)
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  if (loading) return null
  if (workouts.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '20px 0' }}>
        No workouts logged yet
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-theme-hint-color)' }}>
        Recent Workouts
      </p>
      {workouts.slice(0, 7).map(w => {
        const totalSets = w.exercises.reduce((s, ex) => s + ex.sets.length, 0)
        const date = new Date(w.workout_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        return (
          <div key={w.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 500, color: 'var(--tg-theme-text-color)', marginBottom: '2px' }}>
                {w.name}
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
                {date} · {w.exercises.length} exercises · {totalSets} sets
                {w.calories_burned ? ` · ${Math.round(w.calories_burned)} kcal` : ''}
              </p>
            </div>
            <button onClick={() => handleDelete(w.id)} style={{
              background: 'none', border: 'none', color: 'var(--tg-theme-hint-color)',
              fontSize: '16px', cursor: 'pointer', padding: '4px',
            }}>×</button>
          </div>
        )
      })}
    </div>
  )
}
