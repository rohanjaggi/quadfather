'use client'

import { useState, useEffect } from 'react'
import { getExerciseProgress } from '@/lib/api'
import type { ProgressData } from '@/types/exercises'

interface ExerciseSuggestionProps {
  exerciseName: string
  enabled?: boolean
}

export default function ExerciseSuggestion({ exerciseName, enabled = true }: ExerciseSuggestionProps) {
  const [data, setData] = useState<ProgressData | null>(null)

  useEffect(() => {
    if (!enabled || !exerciseName || exerciseName.length < 3) {
      setData(null)
      return
    }

    let cancelled = false
    const timeout = setTimeout(() => {
      getExerciseProgress(exerciseName)
        .then(d => { if (!cancelled) setData(d) })
        .catch(() => { if (!cancelled) setData(null) })
    }, 500)

    return () => { cancelled = true; clearTimeout(timeout) }
  }, [exerciseName, enabled])

  if (!enabled || !data || data.status === 'new') return null

  return (
    <div style={{
      padding: '8px 12px', borderRadius: '10px',
      backgroundColor: data.status === 'stalled'
        ? 'rgba(255, 149, 0, 0.08)'
        : 'rgba(48, 209, 88, 0.08)',
      marginTop: '6px',
    }}>
      {data.last_session && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '3px' }}>
          Last: {data.last_session.sets.length}x{data.last_session.sets[0]?.reps}
          {data.last_session.sets[0]?.weight_kg ? ` @ ${data.last_session.sets[0].weight_kg}kg` : ''}
          {' '}({data.last_session.date})
        </p>
      )}
      {data.suggestion && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
          {data.status === 'stalled' ? '⚠ ' : '↑ '}
          {data.suggestion.value ? `Try ${data.suggestion.value}` : data.suggestion.reason}
        </p>
      )}
      {data.status === 'stalled' && data.stall_weeks > 0 && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', marginTop: '2px' }}>
          Stalled {data.stall_weeks}+ weeks — {data.suggestion?.reason}
        </p>
      )}
    </div>
  )
}
