'use client'

import { useState, useEffect } from 'react'
import { getExercisePrediction } from '@/lib/api'
import type { PredictionData } from '@/types/exercises'

/**
 * Session cache of predictions, keyed by normalised exercise name.
 *
 * `/api/workouts/predict` is a paid LLM call, so a name is fetched at most once
 * per page load. A successful "no prediction" answer (`null`) is cached — asking
 * again would only buy the same answer. A *failed* request is deliberately not
 * cached: one 500 or offline blip used to suppress that exercise's suggestion
 * for the rest of the session with no way back short of a reload.
 */
const predictionCache = new Map<string, PredictionData | null>()

/** Requests in flight, so two rows with the same exercise don't both pay. */
const inFlight = new Map<string, Promise<PredictionData | null>>()

function cacheKey(name: string) {
  return name.trim().toLowerCase()
}

function fetchPrediction(name: string): Promise<PredictionData | null> {
  const key = cacheKey(name)
  const existing = inFlight.get(key)
  if (existing) return existing

  const request = getExercisePrediction(name.trim())
    .then(data => {
      predictionCache.set(key, data)
      return data
    })
    .catch(err => {
      // No cache write — leaving the key absent is what makes a retry possible.
      console.error('Exercise prediction failed:', err)
      return null
    })
    .finally(() => { inFlight.delete(key) })

  inFlight.set(key, request)
  return request
}

interface ExerciseSuggestionProps {
  /**
   * The *committed* exercise name — set on catalogue selection, on blur, or
   * when the exercise row is focused. Deliberately not the live input value:
   * typing must never trigger a prediction.
   */
  exerciseName: string
  enabled?: boolean
}

export default function ExerciseSuggestion({ exerciseName, enabled = true }: ExerciseSuggestionProps) {
  const [data, setData] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const name = exerciseName.trim()
    if (!enabled || name.length < 3) {
      setData(null)
      setLoading(false)
      return
    }

    const key = cacheKey(name)
    if (predictionCache.has(key)) {
      setData(predictionCache.get(key) ?? null)
      setLoading(false)
      return
    }

    // Gates the state update; a response that lands after the row moved on to
    // another exercise is ignored rather than rendered.
    const controller = new AbortController()
    setLoading(true)
    fetchPrediction(name).then(result => {
      if (controller.signal.aborted) return
      setData(result)
      setLoading(false)
    })

    return () => controller.abort()
  }, [exerciseName, enabled])

  if (!enabled) return null
  if (loading) {
    return (
      <div style={{
        marginTop: '8px',
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid var(--surface-border)',
      }}>
        <div style={{
          height: '11px',
          width: '60%',
          borderRadius: '4px',
          backgroundColor: 'var(--surface-border)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
    )
  }
  if (!data || !data.prediction) return null

  return (
    <div style={{
      marginTop: '8px',
      borderRadius: '10px',
      border: '1px solid var(--surface-border)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          padding: '10px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--accent-protein)',
        }}>
          Suggested: {data.prediction.sets.length} sets
        </span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '10px',
          color: 'var(--tg-theme-hint-color)',
          transition: 'transform 0.2s ease-out',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▾
        </span>
      </button>
      {open && (
        <div style={{
          padding: '0 12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {data.prediction.sets.map((set, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                color: 'var(--tg-theme-hint-color)',
                width: '14px',
              }}>
                {i + 1}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--tg-theme-text-color)',
              }}>
                {set.weight_kg == null
                  ? `${set.reps} reps (bodyweight)`
                  : `${set.reps} reps × ${set.weight_kg}kg`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
