'use client'

import { useState } from 'react'
import { parseWorkout } from '@/lib/api'
import type { ExerciseSet } from '@/types/workouts'
import { AiWorking, friendlyError } from './bits'

export interface ParsedWorkout {
  name: string
  exercises: { exercise_name: string; sets: ExerciseSet[] }[]
}

interface AiParseInputProps {
  /** The parsed workout, handed to the logger to check and finish. */
  onParsed: (parsed: ParsedWorkout) => void
  onBack: () => void
}

/** "Describe it": type the session out, the model fills in the sets. */
export default function AiParseInput({ onParsed, onBack }: AiParseInputProps) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse() {
    if (!text.trim() || parsing) return
    setParsing(true)
    setError(null)
    try {
      const result = await parseWorkout(text)
      onParsed({
        name: result.name,
        exercises: result.exercises.map(ex => ({
          exercise_name: ex.exercise_name,
          sets: ex.sets,
        })),
      })
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t read that just now. Check your connection and try again.'))
    } finally {
      setParsing(false)
    }
  }

  return (
    <section className="card" aria-labelledby="describe-title">
      <h2 id="describe-title" className="card-title" style={{ margin: '0 0 4px' }}>Describe it</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
        Write it the way you’d text a friend. You’ll check the sets before anything is saved.
      </p>
      <label htmlFor="describe-text" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Your workout
      </label>
      <textarea
        id="describe-text"
        className="textarea-field"
        value={text}
        onChange={e => setText(e.target.value)}
        readOnly={parsing}
        placeholder="Bench 80 kg 4×8, incline dumbbell 30 kg 3×10, pushdowns 20 kg 3×12"
        rows={5}
      />
      {parsing && <div style={{ marginTop: 12 }}><AiWorking label="Reading your workout…" height={44} /></div>}
      {error && !parsing && (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--ink)' }}>{error}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        <button type="button" className="btn-primary" onClick={handleParse} disabled={parsing || !text.trim()}>
          {parsing ? 'Reading…' : error ? 'Retry' : 'Read it'}
        </button>
        <button type="button" className="btn-ghost" onClick={onBack} disabled={parsing}>Back</button>
      </div>
    </section>
  )
}
