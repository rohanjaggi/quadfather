'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deleteWorkout, logWorkout, getTemplates, getWorkouts } from '@/lib/api'
import PageHeader from '@/components/ui/PageHeader'
import Sheet from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { toastWithUndo } from '@/components/ui/undo'
import { ChevronRightIcon, EditIcon, PlusIcon, TextIcon } from '@/components/ui/icons'
import { useHaptic } from '@/components/telegram'
import WorkoutForm from '@/components/workouts/WorkoutForm'
import AiParseInput, { type ParsedWorkout } from '@/components/workouts/AiParseInput'
import TemplateList from '@/components/workouts/TemplateList'
import TemplateCreator from '@/components/workouts/TemplateCreator'
import WorkoutDone, { type SavedWorkout } from '@/components/workouts/WorkoutDone'
import { friendlyError } from '@/components/workouts/bits'
import type { ExerciseLogEntry, ExerciseSet, WorkoutLogCreate, WorkoutTemplate } from '@/types/workouts'
import { useUser } from '@/context/UserContext'
import { dayKey } from '@/lib/day'

type Step =
  | { kind: 'start' }
  | { kind: 'describe' }
  | {
    kind: 'logger'
    /** Remounts the form, so every start is a fresh draft. */
    key: number
    source: 'manual' | 'ai_parse'
    name?: string
    exercises?: { exercise_name: string; exercise_id?: number | null; sets: ExerciseSet[] }[]
    templateId?: number
    duration?: number
    notes?: string
  }
  | { kind: 'done'; saved: SavedWorkout }

type LoggerStep = Extract<Step, { kind: 'logger' }>

/** A save undone after leaving this page: it reopens the logger on the next mount. */
let undoneDraft: LoggerStep | null = null

export default function WorkoutsLogPage() {
  const { refresh } = useUser()
  const haptic = useHaptic()
  const router = useRouter()
  const [step, setStep] = useState<Step>(() => undoneDraft ?? { kind: 'start' })
  // Cleared in an effect, not the initializer, which StrictMode runs twice.
  useEffect(() => { undoneDraft = null }, [])
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [creating, setCreating] = useState(false)
  // Stable, so the sheet's focus effect doesn't re-run when this page re-renders.
  const closeCreator = useCallback(() => setCreating(false), [])

  // One fetch shared by the template rows and the logger they open.
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
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
        setTemplatesError(friendlyError(err, 'Couldn’t load your templates.'))
      })
      .finally(() => setTemplatesLoading(false))
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  // "Last done" per template, from recent sessions. A nicety: a failure just
  // leaves the dates off.
  const [lastDone, setLastDone] = useState<Map<number, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    getWorkouts(90)
      .then(ws => {
        if (cancelled) return
        const m = new Map<number, string>()
        // Newest first, so the first hit per template is its latest session.
        for (const w of ws) if (w.template_id != null && !m.has(w.template_id)) m.set(w.template_id, dayKey(new Date(w.workout_date)))
        setLastDone(m)
      })
      .catch(err => console.error('Failed to load recent workouts:', err))
    return () => { cancelled = true }
  }, [])

  useEffect(() => { window.scrollTo({ top: 0 }) }, [step.kind])

  const openLogger = (p: Omit<LoggerStep, 'kind' | 'key'>) =>
    setStep({ kind: 'logger', key: Date.now(), ...p })

  function startTemplate(t: WorkoutTemplate) {
    openLogger({
      source: 'manual',
      name: t.name,
      templateId: t.id,
      exercises: t.exercises.map(ex => ({
        exercise_name: ex.name,
        // Prefill the template's own defaults instead of blank rows.
        sets: Array.from({ length: ex.defaultSets }, () => ({
          reps: ex.defaultReps ?? 0,
          weight_kg: ex.defaultWeightKg ?? null,
        })),
      })),
    })
  }

  async function handleSave(
    data: { name: string; exercises: ExerciseLogEntry[]; duration_minutes?: number; notes?: string; template_id?: number },
    source: 'manual' | 'ai_parse',
  ) {
    const payload: WorkoutLogCreate = {
      name: data.name,
      exercises: data.exercises,
      duration_minutes: data.duration_minutes,
      notes: data.notes,
      template_id: data.template_id,
      source,
    }
    const saved = await logWorkout(payload)
    haptic.notification('success')
    setStep({ kind: 'done', saved })
    toastWithUndo('Workout saved', () => undoSave(saved.id, {
      kind: 'logger', key: Date.now(), source,
      name: payload.name, exercises: payload.exercises, templateId: payload.template_id,
      duration: payload.duration_minutes, notes: payload.notes,
    }))
    // Keep Today and Training in step with what was just logged.
    try {
      await refresh()
    } catch (err) {
      console.error('Failed to refresh after logging workout:', err)
    }
  }

  // Undo: delete the session now and put the user back in the logger with what they entered.
  async function undoSave(id: number, draft: LoggerStep) {
    try {
      await deleteWorkout(id)
    } catch (err) {
      toast(friendlyError(err, 'Couldn’t undo. The workout is still saved.'))
      return
    }
    refresh().catch(err => console.error('Failed to refresh after undoing a workout:', err))
    if (mounted.current) {
      setStep(draft)
    } else {
      undoneDraft = draft
      router.push('/workouts/log')
    }
  }

  // No templates yet: "New template" joins the start rows instead of an empty Templates card.
  const noTemplates = !templatesLoading && !templatesError && templates.length === 0

  const rowStyle: React.CSSProperties = {
    width: '100%', minHeight: 60, padding: '10px 0', border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', color: 'var(--ink)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader title="Log a workout" back={{ href: '/workouts', label: 'Training' }} />

      {step.kind === 'start' && (
        <>
          {!noTemplates && (
            <TemplateList
              templates={templates}
              loading={templatesLoading}
              error={templatesError}
              onRetry={() => loadTemplates()}
              onStart={startTemplate}
              onCreateNew={() => setCreating(true)}
              onDeleted={id => setTemplates(prev => prev.filter(t => t.id !== id))}
              lastDone={lastDone}
            />
          )}

          <section className="card" aria-label="Other ways to start" style={{ padding: '6px 20px' }}>
            <button type="button" style={rowStyle} onClick={() => openLogger({ source: 'manual' })}>
              <span style={{ color: 'var(--muted)', display: 'grid' }}><EditIcon size={22} /></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>Start empty</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Add exercises as you go</span>
              </span>
              <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
            </button>
            <button type="button" style={{ ...rowStyle, borderTop: '1px solid var(--line)' }} onClick={() => setStep({ kind: 'describe' })}>
              <span style={{ color: 'var(--muted)', display: 'grid' }}><TextIcon size={22} /></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>Describe it</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Type it out and the sets get filled in</span>
              </span>
              <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
            </button>
            {noTemplates && (
              <button type="button" style={{ ...rowStyle, borderTop: '1px solid var(--line)' }} onClick={() => setCreating(true)}>
                <span style={{ color: 'var(--muted)', display: 'grid' }}><PlusIcon size={22} /></span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>New template</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Save a routine you repeat</span>
                </span>
                <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
              </button>
            )}
          </section>
        </>
      )}

      {step.kind === 'describe' && (
        <AiParseInput
          onBack={() => setStep({ kind: 'start' })}
          onParsed={(p: ParsedWorkout) => openLogger({ source: 'ai_parse', name: p.name, exercises: p.exercises })}
        />
      )}

      {step.kind === 'logger' && (
        <WorkoutForm
          key={step.key}
          initialName={step.name}
          initialExercises={step.exercises}
          initialDuration={step.duration}
          initialNotes={step.notes}
          templateId={step.templateId}
          onSave={data => handleSave(data, step.source)}
          onClose={() => setStep({ kind: 'start' })}
        />
      )}

      {step.kind === 'done' && (
        <WorkoutDone saved={step.saved} onAnother={() => setStep({ kind: 'start' })} />
      )}

      <Sheet open={creating} onClose={closeCreator} title="New template">
        <TemplateCreator
          onCreated={() => {
            setCreating(false)
            toast('Template saved', { type: 'success' })
            loadTemplates()
          }}
        />
      </Sheet>
    </div>
  )
}
