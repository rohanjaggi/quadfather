'use client'

import { useState, useEffect } from 'react'
import { getExercisePrediction } from '@/lib/api'
import type { PredictionData } from '@/types/exercises'
import { ChevronDownIcon } from '@/components/ui/icons'
import { formatSet, topSet } from './format'

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
    // A paid model call: the AI-working shimmer, sized to the line it becomes.
    return <div className="ai-shimmer" role="status" aria-label="Checking your last session" style={{ height: 14, width: '70%', borderRadius: 7, margin: '2px 0' }} />
  }
  if (!data) return null

  const last = data.last_session ? topSet(data.last_session.sets) : null
  const next = data.prediction ? topSet(data.prediction.sets) : null
  const line = [
    last ? `Last time ${formatSet(last)}` : null,
    next ? `${last ? 'try' : 'Try'} ${formatSet(next)}` : null,
  ].filter(Boolean).join(' · ')
  if (!line) return null
  const prediction = data.prediction
  // Nothing more to unfold without a prediction: last time alone is one line.
  if (!prediction) return <p style={{ margin: '6px 0', fontSize: 13, color: 'var(--muted)' }}>{line}</p>

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, minHeight: 32, padding: 0,
          border: 'none', background: 'none', textAlign: 'left',
          fontSize: 13, color: 'var(--muted)',
        }}
      >
        {line}
        <ChevronDownIcon size={14} style={{ flexShrink: 0, transition: 'transform 0.2s var(--ease-out-expo)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{ padding: '2px 0 6px', fontSize: 13, color: 'var(--muted)' }}>
          <p style={{ margin: 0 }}>
            Suggested: {prediction.sets.map(formatSet).join(', ')}
          </p>
          {prediction.reasoning && <p style={{ margin: '4px 0 0', lineHeight: 1.45 }}>{prediction.reasoning}</p>}
        </div>
      )}
    </div>
  )
}
