'use client'

import { useState } from 'react'
import type { ExerciseLogEntry, ExerciseSet } from '@/types/workouts'
import ExerciseAutocomplete from './ExerciseAutocomplete'
import ExerciseSuggestion from './ExerciseSuggestion'
import { useUser } from '@/context/UserContext'

interface WorkoutFormProps {
  initialName?: string
  initialExercises?: { exercise_name: string; sets: ExerciseSet[] }[]
  templateId?: number
  onSave: (data: { name: string; exercises: ExerciseLogEntry[]; duration_minutes?: number; notes?: string; template_id?: number }) => Promise<void>
  onClose: () => void
}

export default function WorkoutForm({ initialName, initialExercises, templateId, onSave, onClose }: WorkoutFormProps) {
  const { user } = useUser()
  const showSuggestions = (user?.ai_coaching_prefs as Record<string, boolean> | undefined)?.pre_workout_suggestions !== false

  const [name, setName] = useState(initialName ?? '')
  const [exercises, setExercises] = useState<{ exercise_name: string; exercise_id: number | null; sets: ExerciseSet[] }[]>(
    initialExercises?.map(ex => ({ ...ex, exercise_id: null })) ?? [{ exercise_name: '', exercise_id: null, sets: [{ reps: 0, weight_kg: null }] }]
  )
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function addExercise() {
    setExercises(prev => [...prev, { exercise_name: '', exercise_id: null, sets: [{ reps: 0, weight_kg: null }] }])
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function updateExercise(idx: number, name: string, exerciseId: number | null) {
    setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, exercise_name: name, exercise_id: exerciseId } : ex))
  }

  function addSet(exIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, { reps: 0, weight_kg: null }] } : ex
    ))
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) } : ex
    ))
  }

  function updateSet(exIdx: number, setIdx: number, field: 'reps' | 'weight_kg', value: string) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      return {
        ...ex,
        sets: ex.sets.map((s, si) => {
          if (si !== setIdx) return s
          if (field === 'reps') return { ...s, reps: parseInt(value) || 0 }
          return { ...s, weight_kg: value === '' ? null : parseFloat(value) }
        }),
      }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || exercises.length === 0) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        exercises: exercises.map((ex, i) => ({
          exercise_name: ex.exercise_name,
          exercise_id: ex.exercise_id ?? null,
          sets: ex.sets,
          order: i + 1,
        })),
        duration_minutes: duration ? parseInt(duration) : undefined,
        notes: notes.trim() || undefined,
        template_id: templateId,
      })
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%' }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Workout Name</label>
        <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Day" required style={inputStyle} />
      </div>

      {exercises.map((ex, exIdx) => (
        <div key={exIdx} style={{
          padding: '14px', borderRadius: '14px',
          backgroundColor: 'var(--tg-theme-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExerciseAutocomplete
              value={ex.exercise_name}
              onChange={(name, id) => updateExercise(exIdx, name, id)}
            />
            {exercises.length > 1 && (
              <button type="button" onClick={() => removeExercise(exIdx)} style={{
                background: 'none', border: 'none', color: 'var(--accent-calories)',
                fontSize: '18px', cursor: 'pointer', padding: '4px',
              }}>×</button>
            )}
          </div>
          <ExerciseSuggestion exerciseName={ex.exercise_name} enabled={showSuggestions} />

          {ex.sets.map((set, setIdx) => (
            <div key={setIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', width: '20px' }}>
                {setIdx + 1}
              </span>
              <input
                className="input-field"
                type="number"
                placeholder="reps"
                value={set.reps || ''}
                onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>×</span>
              <input
                className="input-field"
                type="number"
                step="0.5"
                placeholder="kg"
                value={set.weight_kg ?? ''}
                onChange={e => updateSet(exIdx, setIdx, 'weight_kg', e.target.value)}
                style={{ flex: 1 }}
              />
              {ex.sets.length > 1 && (
                <button type="button" onClick={() => removeSet(exIdx, setIdx)} style={{
                  background: 'none', border: 'none', color: 'var(--tg-theme-hint-color)',
                  fontSize: '14px', cursor: 'pointer',
                }}>−</button>
              )}
            </div>
          ))}

          <button type="button" onClick={() => addSet(exIdx)} style={{
            background: 'none', border: '1px dashed var(--surface-border)',
            borderRadius: '8px', padding: '6px', fontFamily: 'var(--font-display)',
            fontSize: '11px', color: 'var(--tg-theme-hint-color)', cursor: 'pointer',
          }}>
            + Add Set
          </button>
        </div>
      ))}

      <button type="button" onClick={addExercise} className="btn-secondary">
        + Add Exercise
      </button>

      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Duration (min)</label>
          <input className="input-field" type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Optional" style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Notes</label>
        <input className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Saving…' : 'Log Workout'}
        </button>
      </div>
    </form>
  )
}
