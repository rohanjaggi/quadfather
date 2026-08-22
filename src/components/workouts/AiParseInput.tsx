'use client'

import { useState } from 'react'
import { parseWorkout } from '@/lib/api'
import type { ExerciseSet } from '@/types/workouts'
import WorkoutForm from './WorkoutForm'
import { errorMessage } from '@/lib/errors'

interface AiParseInputProps {
  onSave: (data: { name: string; exercises: { exercise_name: string; sets: ExerciseSet[]; order: number }[]; duration_minutes?: number; notes?: string; template_id?: number }) => Promise<void>
  onClose: () => void
}

export default function AiParseInput({ onSave, onClose }: AiParseInputProps) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<{ name: string; exercises: { exercise_name: string; sets: ExerciseSet[] }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    if (!text.trim()) return
    setParsing(true)
    setError(null)
    try {
      const result = await parseWorkout(text)
      setParsed({
        name: result.name,
        exercises: result.exercises.map(ex => ({
          exercise_name: ex.exercise_name,
          sets: ex.sets,
        })),
      })
    } catch (err) {
      setError(errorMessage(err, 'Failed to parse'))
    } finally {
      setParsing(false)
    }
  }

  if (parsed) {
    return (
      <WorkoutForm
        initialName={parsed.name}
        initialExercises={parsed.exercises}
        onSave={onSave}
        onClose={() => setParsed(null)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-theme-hint-color)' }}>
        Describe your workout
      </p>
      <textarea
        className="input-field"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. bench 80kg 4x8, incline DB 30kg 3x10, tricep pushdowns 20kg 3x12"
        rows={4}
        style={{ resize: 'vertical', fontFamily: 'var(--font-display)', fontSize: '14px' }}
      />
      {error && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--accent-calories)' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleParse} disabled={parsing || !text.trim()} style={{ flex: 1 }}>
          {parsing ? 'Parsing…' : 'Parse with AI'}
        </button>
      </div>
    </div>
  )
}
