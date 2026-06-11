'use client'

import { useState, useEffect } from 'react'
import { getExercisePrediction } from '@/lib/api'
import type { PredictionData } from '@/types/exercises'

interface ExerciseSuggestionProps {
  exerciseName: string
  enabled?: boolean
}

export default function ExerciseSuggestion({ exerciseName, enabled = true }: ExerciseSuggestionProps) {
  const [data, setData] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled || !exerciseName || exerciseName.length < 3) {
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      getExercisePrediction(exerciseName)
        .then(d => { if (!cancelled) setData(d) })
        .catch(() => { if (!cancelled) setData(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 800)

    return () => { cancelled = true; clearTimeout(timeout) }
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
                {set.reps} reps × {set.weight_kg}kg
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
