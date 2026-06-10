'use client'

import { useState, useRef, useEffect } from 'react'
import { logWorkout } from '@/lib/api'
import Link from 'next/link'
import WorkoutForm from '@/components/workouts/WorkoutForm'
import TemplateSelector from '@/components/workouts/TemplateSelector'
import AiParseInput from '@/components/workouts/AiParseInput'
import RecentWorkouts from '@/components/workouts/RecentWorkouts'
import TemplateList from '@/components/workouts/TemplateList'
import TemplateCreator from '@/components/workouts/TemplateCreator'
import type { WorkoutLogCreate } from '@/types/workouts'

type Mode = null | 'template' | 'freestyle' | 'ai' | 'create-template'

export default function WorkoutsLogPage() {
  const [mode, setMode] = useState<Mode>(null)
  const [key, setKey] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [mode])

  function toggle(next: Mode) {
    setMode(prev => prev === next ? null : next)
  }

  async function handleSave(data: { name: string; exercises: { exercise_name: string; sets: { reps: number; weight_kg: number | null }[]; order: number }[]; duration_minutes?: number; notes?: string; template_id?: number }) {
    const payload: WorkoutLogCreate = {
      name: data.name,
      exercises: data.exercises,
      duration_minutes: data.duration_minutes,
      notes: data.notes,
      template_id: data.template_id,
      source: 'manual',
    }
    await logWorkout(payload)
    setMode(null)
    setKey(prev => prev + 1)
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
          {mode === 'template' && <TemplateSelector onSave={handleSave} onClose={() => setMode(null)} />}
          {mode === 'freestyle' && <WorkoutForm onSave={handleSave} onClose={() => setMode(null)} />}
          {mode === 'ai' && <AiParseInput onSave={handleSave} onClose={() => setMode(null)} />}
        </div>
      )}

      {mode === 'create-template' && (
        <div ref={panelRef} className="fade-up" style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '20px', padding: '20px',
        }}>
          <TemplateCreator onClose={() => setMode(null)} onCreated={() => { setMode(null); setKey(prev => prev + 1) }} />
        </div>
      )}

      <div className="fade-up fade-up-2" key={`tpl-${key}`}>
        <TemplateList onCreateNew={() => setMode('create-template')} />
      </div>

      <div className="fade-up fade-up-3" key={key}>
        <RecentWorkouts />
      </div>
    </div>
  )
}
