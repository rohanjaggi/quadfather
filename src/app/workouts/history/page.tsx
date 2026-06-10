'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import SummaryCard from '@/components/dashboard/SummaryCard'
import MuscleMap from '@/components/workouts/MuscleMap'
import { getWorkoutsByDate } from '@/lib/api'
import { calculateMuscleIntensities } from '@/lib/muscle-intensity'
import { useUser } from '@/context/UserContext'
import type { WorkoutLog } from '@/types/workouts'

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

export default function WorkoutHistoryPage() {
  const { user } = useUser()
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d
  })
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWorkouts = useCallback(async (d: Date) => {
    setLoading(true)
    try {
      const data = await getWorkoutsByDate(formatDate(d))
      setWorkouts(data)
    } catch {
      setWorkouts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkouts(date)
  }, [date, fetchWorkouts])

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

  const totalSets = workouts.reduce((sum, w) => sum + w.exercises.reduce((s, ex) => s + ex.sets.length, 0), 0)
  const totalExercises = workouts.reduce((sum, w) => sum + w.exercises.length, 0)
  const totalCalories = workouts.reduce((sum, w) => sum + (w.calories_burned ?? 0), 0)
  const totalDuration = workouts.reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0)

  const muscleIntensities = useMemo(() => {
    const allExercises = workouts.flatMap(w => w.exercises)
    if (allExercises.length === 0) return {}
    return calculateMuscleIntensities(allExercises)
  }, [workouts])

  const isToday = formatDate(date) === formatDate(new Date())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up">
        <Link href="/workouts/log" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Workouts
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
          {displayDate(date) !== formatDate(date) && (
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
              letterSpacing: '0.02em',
            }}>
              {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
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

      {/* Daily summary */}
      {!loading && workouts.length > 0 && (
        <div className="fade-up fade-up-2">
          <SummaryCard title="Summary">
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
              {[
                { label: 'Workouts', value: workouts.length },
                { label: 'Exercises', value: totalExercises },
                { label: 'Sets', value: totalSets },
                ...(totalCalories > 0 ? [{ label: 'kcal', value: Math.round(totalCalories) }] : []),
                ...(totalDuration > 0 ? [{ label: 'min', value: totalDuration }] : []),
              ].map(stat => (
                <div key={stat.label} style={{ textAlign: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '22px',
                    fontWeight: 600, color: 'var(--tg-theme-text-color)',
                    display: 'block', lineHeight: 1,
                  }}>
                    {stat.value}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '10px',
                    color: 'var(--tg-theme-hint-color)',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </SummaryCard>
        </div>
      )}

      {/* Muscle map */}
      {!loading && Object.keys(muscleIntensities).length > 0 && (
        <div className="fade-up fade-up-3">
          <SummaryCard title="Muscles worked">
            <MuscleMap intensities={muscleIntensities} size="md" sex={user?.personal?.sex} />
          </SummaryCard>
        </div>
      )}

      {/* Workouts list */}
      <div className="fade-up fade-up-4">
        <SummaryCard title={
          !loading && workouts.length > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Workouts</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '11px',
                fontWeight: 400, color: 'var(--tg-theme-hint-color)',
                letterSpacing: '0', textTransform: 'none',
              }}>
                {workouts.length} {workouts.length === 1 ? 'session' : 'sessions'}
              </span>
            </div>
          ) : 'Workouts'
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
                Loading workouts
              </p>
            </div>
          ) : workouts.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '22px',
                fontWeight: 400, color: 'var(--tg-theme-hint-color)',
                opacity: 0.6, marginBottom: '6px',
              }}>
                Rest day
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '12px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                No workouts were logged on this day
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {workouts.map((w, wi) => (
                <div key={w.id} style={{
                  padding: '14px 0',
                  borderBottom: wi < workouts.length - 1 ? '1px solid var(--surface-border)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: '15px',
                      fontWeight: 600, color: 'var(--tg-theme-text-color)',
                    }}>
                      {w.name}
                    </p>
                    {w.duration_minutes && (
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: '11px',
                        color: 'var(--tg-theme-hint-color)',
                      }}>
                        {w.duration_minutes} min
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {w.exercises.map((ex, i) => (
                      <div key={i}>
                        <p style={{
                          fontFamily: 'var(--font-display)', fontSize: '13px',
                          fontWeight: 500, color: 'var(--tg-theme-text-color)',
                          marginBottom: '4px',
                        }}>
                          {ex.exercise_name}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {ex.sets.map((s, si) => (
                            <span key={si} style={{
                              fontFamily: 'var(--font-display)', fontSize: '11px',
                              color: 'var(--tg-theme-hint-color)',
                              backgroundColor: 'var(--tg-theme-bg-color)',
                              padding: '3px 7px',
                              borderRadius: '6px',
                            }}>
                              {s.weight_kg ? `${s.reps} x ${s.weight_kg}kg` : `${s.reps} reps`}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {w.notes && (
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px',
                      color: 'var(--tg-theme-hint-color)', marginTop: '8px',
                      fontStyle: 'italic',
                    }}>
                      {w.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SummaryCard>
      </div>

    </div>
  )
}
