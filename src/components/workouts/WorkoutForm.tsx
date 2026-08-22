'use client'

import { useState } from 'react'
import type { ExerciseLogEntry, ExerciseSet } from '@/types/workouts'
import ExerciseAutocomplete from './ExerciseAutocomplete'
import ExerciseSuggestion from './ExerciseSuggestion'
import { useUser } from '@/context/UserContext'
import { errorMessage } from '@/lib/errors'

/**
 * A set as the FORM holds it: the raw strings the user typed, parsed once on
 * submit (the same treatment `ManualFoodForm` uses).
 *
 * Parsing on every keystroke made intermediate values unrepresentable — the
 * weight box ran `parseFloat(value)` and rendered `value={set.weight_kg ?? ''}`,
 * so "0." came back as `0`, re-rendered as "0", and the decimal point was eaten
 * the instant it was typed. `0.5`, `0.` and `.5` could not be entered at all,
 * which on a bar with fractional plates is most of the numbers that matter.
 */
interface DraftSet {
  reps: string
  weight_kg: string
}

const blankSet = (): DraftSet => ({ reps: '', weight_kg: '' })

const toDraftSet = (s: ExerciseSet): DraftSet => ({
  reps: s.reps ? String(s.reps) : '',
  weight_kg: s.weight_kg == null ? '' : String(s.weight_kg),
})

/** `''`, `'.'`, `'-'` and other partial input parse to the fallback, not NaN. */
function toReps(raw: string): number {
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toWeight(raw: string): number | null {
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

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
  /**
   * `resolved` marks a name the catalogue actually knows — picked from the
   * dropdown, typed out to an exact match, or prefilled from a template / AI
   * parse (those are whole names the user already committed to, not keystrokes).
   * It gates the row-focus prediction below.
   */
  const [exercises, setExercises] = useState<{ exercise_name: string; exercise_id: number | null; sets: DraftSet[]; resolved: boolean }[]>(
    initialExercises?.map(ex => ({
      exercise_name: ex.exercise_name,
      exercise_id: null,
      sets: ex.sets.map(toDraftSet),
      resolved: ex.exercise_name.trim().length > 0,
    }))
      ?? [{ exercise_name: '', exercise_id: null, sets: [blankSet()], resolved: false }]
  )
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Names the suggestion panel is allowed to fetch for, per exercise index.
   *
   * A prediction is a paid LLM call, so it is never driven by the live input
   * value. An entry is set only when the exercise is committed (picked from the
   * catalogue, or the name field blurred with text in it) or when the user
   * focuses that exercise row — which is what makes opening a 6-exercise
   * template cost nothing until a row is actually touched.
   */
  const [suggestFor, setSuggestFor] = useState<string[]>(
    () => (initialExercises ?? [{ exercise_name: '' }]).map(() => ''),
  )

  function setSuggestAt(idx: number, name: string) {
    setSuggestFor(prev => {
      if (prev[idx] === name) return prev
      const next = [...prev]
      next[idx] = name
      return next
    })
  }

  function addExercise() {
    setExercises(prev => [...prev, { exercise_name: '', exercise_id: null, sets: [blankSet()], resolved: false }])
    setSuggestFor(prev => [...prev, ''])
  }

  function removeExercise(idx: number) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
    setSuggestFor(prev => prev.filter((_, i) => i !== idx))
  }

  function updateExercise(idx: number, name: string, exerciseId: number | null) {
    // A keystroke arrives with no id, so the row stops counting as resolved
    // until the autocomplete says otherwise (`setResolvedAt`).
    setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, exercise_name: name, exercise_id: exerciseId, resolved: exerciseId !== null } : ex))
    // Typing invalidates whatever was suggested for the previous name.
    setSuggestAt(idx, '')
  }

  function setResolvedAt(idx: number, resolved: boolean) {
    setExercises(prev => {
      if (prev[idx] === undefined || prev[idx].resolved === resolved) return prev
      return prev.map((ex, i) => i === idx ? { ...ex, resolved } : ex)
    })
  }

  function addSet(exIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, blankSet()] } : ex
    ))
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) } : ex
    ))
  }

  // Stores exactly what was typed; `handleSubmit` is the only place that parses.
  function updateSet(exIdx: number, setIdx: number, field: keyof DraftSet, value: string) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      return {
        ...ex,
        sets: ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s),
      }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) return

    // The API 422s empty exercise names and zero-rep sets, and a template row
    // the user skipped is exactly that. Strip them here so the save succeeds
    // with what was actually filled in, rather than failing wholesale.
    const cleaned = exercises
      .map(ex => ({
        exercise_name: ex.exercise_name.trim(),
        exercise_id: ex.exercise_id ?? null,
        sets: ex.sets
          .map(s => ({ reps: toReps(s.reps), weight_kg: toWeight(s.weight_kg) }))
          .filter(s => s.reps >= 1),
      }))
      .filter(ex => ex.exercise_name.length > 0 && ex.sets.length > 0)
      // `order` is assigned after the drop so it stays 1..n with no gaps.
      .map((ex, i) => ({ ...ex, order: i + 1 }))

    if (cleaned.length === 0) {
      setError('Add at least one exercise with a name and a set of 1 rep or more')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: trimmedName,
        exercises: cleaned,
        duration_minutes: duration ? parseInt(duration) : undefined,
        notes: notes.trim() || undefined,
        template_id: templateId,
      })
    } catch (err) {
      // Previously an unhandled rejection: the spinner stopped and the form sat
      // there looking saved.
      setError(errorMessage(err, 'Could not save this workout'))
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
        <div
          key={exIdx}
          // Focusing anywhere in the row counts as "working on this exercise",
          // which is what unlocks the suggestion for template-prefilled names.
          // Gated on `resolved` so a half-typed name ('ben') is never sent to
          // the paid predict endpoint just because the reps field got focus.
          onFocus={() => { if (ex.resolved) setSuggestAt(exIdx, ex.exercise_name.trim()) }}
          style={{
            padding: '14px', borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ExerciseAutocomplete
              value={ex.exercise_name}
              onChange={(name, id) => updateExercise(exIdx, name, id)}
              onCommit={name => setSuggestAt(exIdx, name)}
              onResolvedChange={resolved => setResolvedAt(exIdx, resolved)}
            />
            {exercises.length > 1 && (
              <button type="button" onClick={() => removeExercise(exIdx)} aria-label={`Remove exercise ${exIdx + 1}`} style={{
                background: 'none', border: 'none', color: 'var(--accent-calories)',
                fontSize: '18px', cursor: 'pointer', padding: '4px',
              }}>×</button>
            )}
          </div>
          <ExerciseSuggestion exerciseName={suggestFor[exIdx] ?? ''} enabled={showSuggestions} />

          {ex.sets.map((set, setIdx) => (
            <div key={setIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', width: '20px' }}>
                {setIdx + 1}
              </span>
              <input
                className="input-field"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="reps"
                aria-label={`Set ${setIdx + 1} reps`}
                value={set.reps}
                onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>×</span>
              <input
                className="input-field"
                type="number"
                min="0"
                // `step="0.5"` also made 0.25 a `stepMismatch`, which the browser
                // refuses to submit; the weight is validated server-side.
                step="any"
                inputMode="decimal"
                placeholder="kg"
                aria-label={`Set ${setIdx + 1} weight in kg`}
                value={set.weight_kg}
                onChange={e => updateSet(exIdx, setIdx, 'weight_kg', e.target.value)}
                style={{ flex: 1 }}
              />
              {ex.sets.length > 1 && (
                <button type="button" onClick={() => removeSet(exIdx, setIdx)} aria-label={`Remove set ${setIdx + 1}`} style={{
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
          {saving ? 'Saving…' : 'Log Workout'}
        </button>
      </div>
    </form>
  )
}
