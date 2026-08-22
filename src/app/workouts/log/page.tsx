'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { logWorkout, getTemplates } from '@/lib/api'
import Link from 'next/link'
import WorkoutForm from '@/components/workouts/WorkoutForm'
import TemplateSelector from '@/components/workouts/TemplateSelector'
import AiParseInput from '@/components/workouts/AiParseInput'
import RecentWorkouts from '@/components/workouts/RecentWorkouts'
import TemplateList from '@/components/workouts/TemplateList'
import TemplateCreator from '@/components/workouts/TemplateCreator'
import type { WorkoutLogCreate, WorkoutTemplate } from '@/types/workouts'
import { useUser } from '@/context/UserContext'
import { errorMessage } from '@/lib/errors'

type Mode = null | 'template' | 'freestyle' | 'ai' | 'create-template'

export default function WorkoutsLogPage() {
  const { refresh } = useUser()
  const [mode, setMode] = useState<Mode>(null)
  const [key, setKey] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // One fetch shared by TemplateList and TemplateSelector.
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  // A failed fetch used to look exactly like "you have no templates", which
  // sends people off to recreate templates they already have.
  const [templatesError, setTemplatesError] = useState<string | null>(null)

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true)
    setTemplatesError(null)
    return getTemplates()
      .then(data => {
        setTemplates(data)
        setTemplatesError(null)
      })
      .catch(err => {
        console.error('Failed to load templates:', err)
        setTemplatesError(errorMessage(err, 'Could not load your templates'))
      })
      .finally(() => setTemplatesLoading(false))
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  useEffect(() => {
    if (mode && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [mode])

  function toggle(next: Mode) {
    setMode(prev => prev === next ? null : next)
  }

  const templatesErrorNotice = (
    <p style={{
      fontFamily: 'var(--font-display)', fontSize: '12px', lineHeight: 1.5,
      color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '12px 0',
    }}>
      <span style={{ color: 'var(--accent-calories)' }}>{templatesError}</span>{' '}
      <button
        type="button"
        onClick={() => loadTemplates()}
        disabled={templatesLoading}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'var(--font-display)', fontSize: '12px',
          color: 'var(--tg-theme-button-color)',
        }}
      >
        {templatesLoading ? 'Retrying…' : 'Retry'}
      </button>
    </p>
  )

  async function handleSave(
    data: { name: string; exercises: { exercise_name: string; sets: { reps: number; weight_kg: number | null }[]; order: number }[]; duration_minutes?: number; notes?: string; template_id?: number },
    source: 'manual' | 'ai_parse' = 'manual',
  ) {
    const payload: WorkoutLogCreate = {
      name: data.name,
      exercises: data.exercises,
      duration_minutes: data.duration_minutes,
      notes: data.notes,
      template_id: data.template_id,
      source,
    }
    await logWorkout(payload)
    setMode(null)
    setKey(prev => prev + 1)
    // Keep the dashboard / exercise summaries in step with what was just logged.
    try {
      await refresh()
    } catch (err) {
      console.error('Failed to refresh after logging workout:', err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="fade-up">
        <Link href="/workouts" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '8px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Exercise
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700,
          lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>Workouts</h1>
      </div>

      <div className="fade-up fade-up-1">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {([
            { key: 'template' as const, label: 'Template' },
            { key: 'freestyle' as const, label: 'Freestyle' },
            { key: 'ai' as const, label: 'AI Parse' },
          ]).map(({ key: k, label }) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '4px', padding: '14px 8px', borderRadius: '14px',
                border: mode === k ? '1.5px solid var(--tg-theme-button-color)' : '1.5px solid var(--surface-border)',
                backgroundColor: mode === k ? 'var(--tg-theme-button-color)' : 'transparent',
                color: mode === k ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500,
                letterSpacing: '0.02em', cursor: 'pointer',
                transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {mode && mode !== 'create-template' && (
        <div ref={panelRef} className="fade-up" style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '20px', padding: '20px',
        }}>
          {mode === 'template' && (
            templatesError && !templatesLoading ? templatesErrorNotice : (
              <TemplateSelector
                onSave={handleSave}
                onClose={() => setMode(null)}
                templates={templates}
                loading={templatesLoading}
              />
            )
          )}
          {mode === 'freestyle' && <WorkoutForm onSave={handleSave} onClose={() => setMode(null)} />}
          {mode === 'ai' && <AiParseInput onSave={data => handleSave(data, 'ai_parse')} onClose={() => setMode(null)} />}
        </div>
      )}

      {mode === 'create-template' && (
        <div ref={panelRef} className="fade-up" style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '20px', padding: '20px',
        }}>
          <TemplateCreator onClose={() => setMode(null)} onCreated={() => { setMode(null); loadTemplates() }} />
        </div>
      )}

      <div className="fade-up fade-up-2">
        {templatesError && !templatesLoading ? templatesErrorNotice : (
          <TemplateList
            onCreateNew={() => setMode('create-template')}
            templates={templates}
            loading={templatesLoading}
            onDeleted={id => setTemplates(prev => prev.filter(t => t.id !== id))}
          />
        )}
      </div>

      <div className="fade-up fade-up-3" key={key}>
        <RecentWorkouts />
      </div>
    </div>
  )
}
