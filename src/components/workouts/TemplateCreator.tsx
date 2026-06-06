'use client'

import { useState } from 'react'
import { createTemplate } from '@/lib/api'
import type { TemplateExercise } from '@/types/workouts'

interface TemplateCreatorProps {
  onClose: () => void
  onCreated: () => void
}

export default function TemplateCreator({ onClose, onCreated }: TemplateCreatorProps) {
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState<TemplateExercise[]>([
    { name: '', defaultSets: 3, defaultReps: 10, defaultWeightKg: null },
  ])
  const [saving, setSaving] = useState(false)

  function addExercise() {
    setExercises(prev => [...prev, { name: '', defaultSets: 3, defaultReps: 10, defaultWeightKg: null }])
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function updateExercise(idx: number, field: keyof TemplateExercise, value: string) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== idx) return ex
      if (field === 'name') return { ...ex, name: value }
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
            <input className="input-field" value={ex.name} onChange={e => updateExercise(idx, 'name', e.target.value)} placeholder="Exercise name" required style={{ flex: 1 }} />
            {exercises.length > 1 && (
              <button type="button" onClick={() => removeExercise(idx)} style={{
                background: 'none', border: 'none', color: 'var(--accent-calories)', fontSize: '18px', cursor: 'pointer',
              }}>×</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--tg-theme-hint-color)' }}>Sets</label>
              <input className="input-field" type="number" value={ex.defaultSets || ''} onChange={e => updateExercise(idx, 'defaultSets', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--tg-theme-hint-color)' }}>Reps</label>
              <input className="input-field" type="number" value={ex.defaultReps || ''} onChange={e => updateExercise(idx, 'defaultReps', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--tg-theme-hint-color)' }}>kg</label>
              <input className="input-field" type="number" step="0.5" value={ex.defaultWeightKg ?? ''} onChange={e => updateExercise(idx, 'defaultWeightKg', e.target.value)} placeholder="—" />
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
