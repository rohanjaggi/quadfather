'use client'

import { useState } from 'react'
import { createTemplate } from '@/lib/api'
import type { TemplateExercise } from '@/types/workouts'
import ExerciseAutocomplete from './ExerciseAutocomplete'

interface TemplateCreatorProps {
  onClose: () => void
  onCreated: () => void
}

export default function TemplateCreator({ onClose, onCreated }: TemplateCreatorProps) {
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<(TemplateExercise & { exercise_id?: number | null })[]>([
    { name: '', defaultSets: 3, defaultReps: 0, defaultWeightKg: null, exercise_id: null },
  ])
  const [saving, setSaving] = useState(false)

  function addExercise() {
    setExercises(prev => [...prev, { name: '', defaultSets: 3, defaultReps: 0, defaultWeightKg: null, exercise_id: null }])
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function updateExerciseName(idx: number, name: string, exerciseId: number | null) {
    setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, name, exercise_id: exerciseId } : ex))
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
    setSaving(true)
    try {
      await createTemplate({ name: name.trim(), exercises })
      onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-theme-hint-color)' }}>
        Create Template
      </p>

      <div>
        <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Template Name</label>
        <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Day" required />
      </div>

      {exercises.map((ex, idx) => (
        <div key={idx} style={{
          padding: '12px', borderRadius: '12px', backgroundColor: 'var(--tg-theme-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExerciseAutocomplete
              value={ex.name}
              onChange={(name, id) => updateExerciseName(idx, name, id)}
            />
            {exercises.length > 1 && (
              <button type="button" onClick={() => removeExercise(idx)} style={{
                background: 'none', border: 'none', color: 'var(--accent-calories)', fontSize: '18px', cursor: 'pointer',
              }}>×</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--tg-theme-hint-color)' }}>Sets</label>
              <input className="input-field" type="number" value={ex.defaultSets || ''} onChange={e => updateExerciseField(idx, 'defaultSets', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addExercise} className="btn-secondary">+ Add Exercise</button>

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </form>
  )
}
