'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { getWorkouts, deleteWorkout } from '@/lib/api'
import type { WorkoutLog } from '@/types/workouts'
import WorkoutAnalysis from './WorkoutAnalysis'
import { useUser } from '@/context/UserContext'
import SwipeToDelete, { SwipeDeleteProvider } from '@/components/SwipeToDelete'
import { toast, errorMessage } from '@/components/ui/Toast'

const VISIBLE_COUNT = 7

export default function RecentWorkouts() {
  const { user } = useUser()
  const showAnalysis = (user?.ai_coaching_prefs as Record<string, boolean> | undefined)?.workout_analysis !== false

  const [workouts, setWorkouts] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorkouts(30)
      .then(setWorkouts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => workouts.slice(0, VISIBLE_COUNT), [workouts])

  // Analysis is a paid LLM call per workout (and sends a Telegram message), so
  // only the newest un-analysed session runs on its own; the rest get an
  // explicit "Analyse" button.
  //
  // The target is latched ONCE, the first time a non-empty list is rendered,
  // and never re-derived. Deriving it live meant deleting the auto-analysed
  // workout promoted the next one, billing an unrequested analysis per swipe.
  // `undefined` = not latched yet, `null` = latched to "nothing to analyse".
  const autoAnalyseIdRef = useRef<number | null | undefined>(undefined)
  if (autoAnalyseIdRef.current === undefined && visible.length > 0) {
    autoAnalyseIdRef.current = visible.find(w => !w.analysis)?.id ?? null
  }
  const autoAnalyseId = autoAnalyseIdRef.current ?? null

  // Rethrow after toasting so SwipeToDelete restores the row it hid.
  async function handleDelete(id: number) {
    try {
      await deleteWorkout(id)
    } catch (err) {
      toast(errorMessage(err, 'Could not delete this workout'), { type: 'error' })
      throw err
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-theme-hint-color)' }}>
          Recent Workouts
        </p>
        <Link href="/workouts/history" style={{
          fontFamily: 'var(--font-display)', fontSize: '11px',
          fontWeight: 500, color: 'var(--tg-theme-hint-color)',
          textDecoration: 'none',
        }}>
          History {'→'}
        </Link>
      </div>
      <SwipeDeleteProvider>
        {visible.map(w => {
          const totalSets = w.exercises.reduce((s, ex) => s + ex.sets.length, 0)
          // `workout_date` is a UTC-day timestamp and the rest of the app reads
          // it as one (`workout_date.startsWith(today)` on the dashboard,
          // `split('T')[0]` in `lib/volume`). Formatting it in local time
          // rendered the previous day for anyone west of UTC, so the day part
          // is taken as-is and formatted in UTC.
          const date = new Date(`${w.workout_date.split('T')[0]}T00:00:00Z`)
            .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
          return (
            <SwipeToDelete key={w.id} id={`workout-${w.id}`} onDelete={() => handleDelete(w.id)} borderRadius="14px">
              <div style={{
                padding: '14px 16px', borderRadius: '14px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 500, color: 'var(--tg-theme-text-color)', marginBottom: '2px' }}>
                      {w.name}
                    </p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
                      {date} · {w.exercises.length} exercises · {totalSets} sets
                      {w.calories_burned ? ` · ${Math.round(w.calories_burned)} kcal` : ''}
                    </p>
                  </div>
                </div>
                {showAnalysis && (
                  <WorkoutAnalysis
                    workoutId={w.id}
                    existingAnalysis={w.analysis}
                    exercises={w.exercises}
                    autoAnalyse={w.id === autoAnalyseId}
                  />
                )}
              </div>
            </SwipeToDelete>
          )
        })}
      </SwipeDeleteProvider>
    </div>
  )
}
