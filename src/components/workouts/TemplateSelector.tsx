'use client'

import { useState, useEffect } from 'react'
import { getTemplates } from '@/lib/api'
import type { WorkoutTemplate, ExerciseSet } from '@/types/workouts'
import WorkoutForm from './WorkoutForm'

interface TemplateSelectorProps {
  onSave: (data: { name: string; exercises: { exercise_name: string; sets: ExerciseSet[]; order: number }[]; duration_minutes?: number; notes?: string; template_id?: number }) => Promise<void>
  onClose: () => void
}

export default function TemplateSelector({ onSave, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<WorkoutTemplate | null>(null)

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (selected) {
    return (
      <WorkoutForm
        initialName={selected.name}
        initialExercises={selected.exercises.map(ex => ({
          exercise_name: ex.name,
          sets: Array.from({ length: ex.defaultSets }, () => ({
            reps: 0,
            weight_kg: null,
          })),
        }))}
        templateId={selected.id}
        onSave={onSave}
        onClose={() => setSelected(null)}
      />
    )
  }

  if (loading) {
    return <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center' }}>Loading templates…</p>
  }

  if (templates.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', marginBottom: '12px' }}>
          No templates yet. Create one below!
        </p>
        <button type="button" className="btn-secondary" onClick={onClose}>Back</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-theme-hint-color)' }}>
        Select a template
      </p>
      {templates.map(t => (
        <button
          key={t.id}
          onClick={() => setSelected(t)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', borderRadius: '14px', border: '1.5px solid var(--surface-border)',
            backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
            {t.name}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
            {t.exercises.length} exercises
          </span>
        </button>
      ))}
      <button type="button" className="btn-secondary" onClick={onClose} style={{ marginTop: '8px' }}>Back</button>
    </div>
  )
}
