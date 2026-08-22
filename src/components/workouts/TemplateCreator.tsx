'use client'

import { useState } from 'react'
import { createTemplate } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import type { TemplateExercise } from '@/types/workouts'
import ExerciseAutocomplete from './ExerciseAutocomplete'

interface TemplateCreatorProps {
  onClose: () => void
  onCreated: () => void
}

/**
 * Matches the server's own fallback in `POST /api/workouts/templates`. It used
 * to be 0, which is a valid number so the route stored it verbatim rather than
 * defaulting — every new template then opened with every set at 0 reps.
 */
const DEFAULT_REPS = 10
const DEFAULT_SETS = 3

function blankExercise(): TemplateExercise {
  return { name: '', defaultSets: DEFAULT_SETS, defaultReps: DEFAULT_REPS, defaultWeightKg: null }
}

export default function TemplateCreator({ onClose, onCreated }: TemplateCreatorProps) {
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<TemplateExercise[]>([blankExercise()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addExercise() {
    setExercises(prev => [...prev, blankExercise()])
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  // The template route stores `{name, defaultSets, defaultReps, defaultWeightKg}`
  // and drops everything else, so the catalogue id the autocomplete hands back
  // is deliberately not kept — sending it was pure noise.
  function updateExerciseName(idx: number, name: string) {
    setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, name } : ex))
  }

  function updateExerciseField(idx: number, field: 'defaultSets' | 'defaultReps' | 'defaultWeightKg', value: string) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== idx) return ex
      if (field === 'defaultWeightKg') return { ...ex, defaultWeightKg: value === '' ? null : parseFloat(value) }
      return { ...ex, [field]: parseInt(value) || 0 }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || exercises.length === 0 || exercises.some(ex => !ex.name.trim())) return
    // A cleared Sets/Reps box holds 0, and 0 is a valid number the route stores
    // verbatim rather than defaulting — so the fallback is applied here.
    const payload = exercises.map(ex => ({
      name: ex.name.trim(),
      defaultSets: ex.defaultSets || DEFAULT_SETS,
      defaultReps: ex.defaultReps || DEFAULT_REPS,
      defaultWeightKg: ex.defaultWeightKg,
    }))

    setSaving(true)
    setError(null)
    let created = false
    try {
      await createTemplate({ name: name.trim(), exercises: payload })
      created = true
    } catch (err) {
      // Previously uncaught: a failed create left the button back on "Save
      // Template" with no indication that nothing had been saved.
      setError(errorMessage(err, 'Could not create this template'))
    } finally {
      setSaving(false)
    }
    if (created) onCreated()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-theme-hint-color)' }}>
        Create Template
      </p>

      <div>
        <label htmlFor="template-name" className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Template Name</label>
        <input id="template-name" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Day" required />
      </div>

      {exercises.map((ex, idx) => (
        <div key={idx} style={{
          padding: '12px', borderRadius: '12px', backgroundColor: 'var(--tg-theme-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExerciseAutocomplete
              value={ex.name}
              onChange={name => updateExerciseName(idx, name)}
            />
            {exercises.length > 1 && (
              <button type="button" onClick={() => removeExercise(idx)} style={{
                background: 'none', border: 'none', color: 'var(--accent-calories)', fontSize: '18px', cursor: 'pointer',
              }}>×</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor={`template-sets-${idx}`} style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--tg-theme-hint-color)' }}>Sets</label>
              <input id={`template-sets-${idx}`} className="input-field" type="number" min="1" value={ex.defaultSets || ''} onChange={e => updateExerciseField(idx, 'defaultSets', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor={`template-reps-${idx}`} style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--tg-theme-hint-color)' }}>Reps</label>
              <input id={`template-reps-${idx}`} className="input-field" type="number" min="1" value={ex.defaultReps || ''} onChange={e => updateExerciseField(idx, 'defaultReps', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addExercise} className="btn-secondary">+ Add Exercise</button>

      {error && (
        <p role="alert" style={{
          fontFamily: 'var(--font-display)', fontSize: '12px', lineHeight: 1.5,
          color: 'var(--accent-calories)', padding: '10px 12px',
          borderRadius: '10px', backgroundColor: 'var(--tg-theme-bg-color)',
        }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </form>
  )
}
