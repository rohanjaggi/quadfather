'use client'

import { useState } from 'react'
import { createTemplate } from '@/lib/api'
import type { TemplateExercise } from '@/types/workouts'
import { PlusIcon, TrashIcon } from '@/components/ui/icons'
import ExerciseAutocomplete from './ExerciseAutocomplete'
import { friendlyError } from './bits'

interface TemplateCreatorProps {
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

/** The "New template" form; the page shows it in a sheet. */
export default function TemplateCreator({ onCreated }: TemplateCreatorProps) {
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
      setError(friendlyError(err, 'Couldn’t save this template. Try again.'))
    } finally {
      setSaving(false)
    }
    if (created) onCreated()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label htmlFor="template-name" className="label-caps">Name</label>
        <input id="template-name" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push day" required />
      </div>

      {exercises.map((ex, idx) => (
        <div key={idx} style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <ExerciseAutocomplete
              value={ex.name}
              label={`Exercise ${idx + 1} name`}
              onChange={name => updateExerciseName(idx, name)}
            />
            {exercises.length > 1 && (
              <button
                type="button"
                onClick={() => removeExercise(idx)}
                aria-label={`Remove ${ex.name.trim() || `exercise ${idx + 1}`}`}
                style={{ width: 44, height: 44, flexShrink: 0, border: 'none', background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}
              >
                <TrashIcon size={20} />
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label htmlFor={`template-sets-${idx}`} className="label-caps">Sets</label>
              <input id={`template-sets-${idx}`} className="input-field" type="number" inputMode="numeric" min="1" value={ex.defaultSets || ''} onChange={e => updateExerciseField(idx, 'defaultSets', e.target.value)} />
            </div>
            <div>
              <label htmlFor={`template-reps-${idx}`} className="label-caps">Reps</label>
              <input id={`template-reps-${idx}`} className="input-field" type="number" inputMode="numeric" min="1" value={ex.defaultReps || ''} onChange={e => updateExerciseField(idx, 'defaultReps', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addExercise} className="btn-ghost" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: -14 }}>
        <PlusIcon size={18} /> Add exercise
      </button>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: 'var(--ink)' }}>{error}</p>
      )}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : error ? 'Retry' : 'Save template'}
      </button>
    </form>
  )
}
