'use client'

import { useCallback, useRef, useState } from 'react'
import type { ExerciseLogEntry, ExerciseSet } from '@/types/workouts'
import ExerciseAutocomplete from './ExerciseAutocomplete'
import ExerciseSuggestion from './ExerciseSuggestion'
import Sheet from '@/components/ui/Sheet'
import { CloseIcon, PlusIcon, TrashIcon } from '@/components/ui/icons'
import { useUser } from '@/context/UserContext'
import { friendlyError } from './bits'

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

interface DraftExercise {
  /** Stable key, so removing a card never hands its state to the next one. */
  uid: number
  exercise_name: string
  exercise_id: number | null
  sets: DraftSet[]
  /**
   * Marks a name the catalogue actually knows — picked from the dropdown,
   * typed out to an exact match, or prefilled from a template / AI parse
   * (whole names the user already committed to, not keystrokes). It gates the
   * card-focus prediction below.
   */
  resolved: boolean
  /**
   * The name the suggestion line may fetch for. A prediction is a paid LLM
   * call, so it is never driven by the live input value: it is set only when
   * the exercise is committed (picked, or the name field blurred with text) or
   * when the user focuses that card — which is what makes opening a
   * 6-exercise template cost nothing until a card is actually touched.
   */
  suggest: string
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
  /** "Start over": back to choosing how to start. */
  onClose: () => void
}

const iconBtn: React.CSSProperties = {
  width: 44, height: 44, flexShrink: 0, padding: 0, border: 'none', borderRadius: 12,
  background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center',
}

const numberInput: React.CSSProperties = {
  minHeight: 52, padding: '8px 6px', textAlign: 'center',
  fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', minWidth: 0,
}

export default function WorkoutForm({ initialName, initialExercises, templateId, onSave, onClose }: WorkoutFormProps) {
  const { user } = useUser()
  const showSuggestions = (user?.ai_coaching_prefs as Record<string, boolean> | undefined)?.pre_workout_suggestions !== false

  const nextUid = useRef(0)
  const uid = () => ++nextUid.current

  const [name, setName] = useState(initialName ?? '')
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    (initialExercises ?? []).map(ex => ({
      uid: uid(),
      exercise_name: ex.exercise_name,
      exercise_id: null,
      sets: ex.sets.length > 0 ? ex.sets.map(toDraftSet) : [blankSet()],
      resolved: ex.exercise_name.trim().length > 0,
      suggest: '',
    })),
  )
  const [adding, setAdding] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Only a failed save gets "Retry saving"; a validation hint keeps "Finish workout". */
  const [saveFailed, setSaveFailed] = useState(false)
  const [touched, setTouched] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const closeDiscard = useCallback(() => setConfirmDiscard(false), [])

  function edit(fn: (prev: DraftExercise[]) => DraftExercise[]) {
    setTouched(true)
    setExercises(fn)
  }

  const patch = (idx: number, p: Partial<DraftExercise>) =>
    edit(prev => prev.map((ex, i) => (i === idx ? { ...ex, ...p } : ex)))

  function setSuggestAt(idx: number, n: string) {
    setExercises(prev => (prev[idx] === undefined || prev[idx].suggest === n ? prev : prev.map((ex, i) => (i === idx ? { ...ex, suggest: n } : ex))))
  }

  function addExercise(rawName: string, exerciseId: number | null) {
    const n = rawName.trim()
    if (!n) return
    edit(prev => [...prev, {
      uid: uid(), exercise_name: n, exercise_id: exerciseId, sets: [blankSet()],
      resolved: exerciseId !== null,
      // Adding is a commit, the same as picking or blurring a name used to be.
      suggest: n,
    }])
    setAdding('')
  }

  function updateExercise(idx: number, n: string, exerciseId: number | null) {
    // A keystroke arrives with no id, so the card stops counting as resolved
    // until the autocomplete says otherwise (`setResolvedAt`). Typing also
    // invalidates whatever was suggested for the previous name.
    patch(idx, { exercise_name: n, exercise_id: exerciseId, resolved: exerciseId !== null, suggest: '' })
  }

  function setResolvedAt(idx: number, resolved: boolean) {
    setExercises(prev => (prev[idx] === undefined || prev[idx].resolved === resolved ? prev : prev.map((ex, i) => (i === idx ? { ...ex, resolved } : ex))))
  }

  // Stores exactly what was typed; `handleSubmit` is the only place that parses.
  function updateSet(exIdx: number, setIdx: number, field: keyof DraftSet, value: string) {
    edit(prev => prev.map((ex, i) => (i !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, si) => (si === setIdx ? { ...s, [field]: value } : s)),
    })))
  }

  function addSet(exIdx: number) {
    edit(prev => prev.map((ex, i) => (i !== exIdx ? ex : { ...ex, sets: [...ex.sets, blankSet()] })))
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setSaveFailed(false)
      setError('Give this workout a name first.')
      return
    }

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
      setSaveFailed(false)
      setError('Add at least one exercise with a set of 1 rep or more.')
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
      setSaveFailed(true)
      setError(friendlyError(err, 'Couldn’t save this workout. Your sets are still here.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 84 }}>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label htmlFor="workout-name" className="label-caps" style={{ margin: 0 }}>Workout name</label>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => (touched ? setConfirmDiscard(true) : onClose())}
            style={{ marginRight: -14, minHeight: 36, padding: '6px 14px', fontSize: 14 }}
          >
            Start over
          </button>
        </div>
        <input
          id="workout-name"
          className="input-field"
          value={name}
          onChange={e => { setTouched(true); setName(e.target.value) }}
          placeholder="e.g. Push day"
          required
          style={{ fontSize: 17, fontWeight: 600 }}
        />
      </section>

      {exercises.map((ex, exIdx) => {
        const label = ex.exercise_name.trim() || `exercise ${exIdx + 1}`
        return (
          <section
            key={ex.uid}
            className="card"
            aria-label={label}
            // Focusing anywhere in the card counts as "working on this exercise",
            // which is what unlocks the suggestion for template-prefilled names.
            // Gated on `resolved` so a half-typed name ('ben') is never sent to
            // the paid predict endpoint just because the reps field got focus.
            onFocus={() => { if (ex.resolved) setSuggestAt(exIdx, ex.exercise_name.trim()) }}
            // The name dropdown has to escape the card.
            style={{ overflow: 'visible', padding: '14px 16px 10px' }}
          >
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <ExerciseAutocomplete
                value={ex.exercise_name}
                label={`Exercise ${exIdx + 1} name`}
                onChange={(n, id) => updateExercise(exIdx, n, id)}
                onCommit={n => setSuggestAt(exIdx, n)}
                onResolvedChange={resolved => setResolvedAt(exIdx, resolved)}
                inputStyle={{ fontSize: 17, fontWeight: 600, border: '1px solid transparent', paddingLeft: 4, background: 'transparent' }}
              />
              <button
                type="button"
                onClick={() => edit(prev => prev.filter((_, i) => i !== exIdx))}
                aria-label={`Remove ${label}`}
                style={iconBtn}
              >
                <TrashIcon size={20} />
              </button>
            </div>
            <div style={{ padding: '0 4px' }}>
              <ExerciseSuggestion exerciseName={ex.suggest} enabled={showSuggestions} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) 14px minmax(0, 1fr) 44px', alignItems: 'center', columnGap: 6, rowGap: 8, marginTop: 8 }}>
              <span aria-hidden="true" />
              <span aria-hidden="true" style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>kg</span>
              <span aria-hidden="true" />
              <span aria-hidden="true" style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>reps</span>
              <span aria-hidden="true" />
              {ex.sets.map((set, setIdx) => (
                <SetRow
                  key={setIdx}
                  n={setIdx + 1}
                  label={label}
                  set={set}
                  onChange={(field, value) => updateSet(exIdx, setIdx, field, value)}
                  onRemove={ex.sets.length > 1
                    ? () => edit(prev => prev.map((e2, i) => (i !== exIdx ? e2 : { ...e2, sets: e2.sets.filter((_, si) => si !== setIdx) })))
                    : undefined}
                />
              ))}
            </div>

            <button type="button" className="btn-ghost" onClick={() => addSet(exIdx)} style={{ marginTop: 4, marginLeft: -10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PlusIcon size={18} /> Add set
            </button>
          </section>
        )
      })}

      <section
        className="card"
        style={{ overflow: 'visible' }}
        aria-labelledby="add-exercise"
        // Enter here adds the exercise instead of submitting the whole workout.
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault()
            addExercise(adding, null)
          }
        }}
      >
        <h2 id="add-exercise" className="card-title" style={{ margin: '0 0 10px' }}>
          {exercises.length === 0 ? 'First exercise' : 'Add exercise'}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExerciseAutocomplete
            value={adding}
            label="Add an exercise"
            placeholder="Search or type a name"
            required={false}
            autoFocus={exercises.length === 0 && !initialExercises}
            onChange={n => setAdding(n)}
            // Picking from the list adds it; a blur alone never does.
            onCommit={(n, id) => { if (id !== null) addExercise(n, id) }}
          />
          {adding.trim() && (
            <button type="button" className="btn-secondary" onClick={() => addExercise(adding, null)} style={{ flexShrink: 0 }}>
              Add
            </button>
          )}
        </div>
      </section>

      <section className="card" style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 12 }}>
        <div>
          <label htmlFor="workout-duration" className="label-caps">Minutes</label>
          <input
            id="workout-duration"
            className="input-field"
            type="number"
            inputMode="numeric"
            min="0"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="workout-notes" className="label-caps">Notes</label>
          <input id="workout-notes" className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
        </div>
      </section>

      {/* Pinned above the tab bar; the form's bottom padding keeps it off the last inputs. */}
      <div style={{
        position: 'fixed', left: 0, right: 0, zIndex: 20,
        bottom: 'calc(84px + env(safe-area-inset-bottom))',
        padding: '18px 18px 8px',
        background: 'linear-gradient(to top, var(--ground) 72%, rgba(243, 238, 232, 0))',
      }}>
        {error && (
          <div role="alert" style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line-strong)', fontSize: 14, color: 'var(--ink)' }}>
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : saveFailed ? 'Retry saving' : 'Finish workout'}
        </button>
      </div>

      <Sheet open={confirmDiscard} onClose={closeDiscard} title="Discard this workout?">
        <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--muted)' }}>
          Nothing has been saved yet. Starting over clears the sets you’ve entered.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={() => setConfirmDiscard(false)}>Keep logging</button>
          <button type="button" className="btn-ghost" onClick={() => { setConfirmDiscard(false); onClose() }} style={{ color: 'var(--over)' }}>
            Discard and start over
          </button>
        </div>
      </Sheet>
    </form>
  )
}

function SetRow({ n, label, set, onChange, onRemove }: {
  n: number
  label: string
  set: DraftSet
  onChange: (field: keyof DraftSet, value: string) => void
  onRemove?: () => void
}) {
  return (
    <>
      <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>{n}</span>
      <input
        className="input-field"
        type="number"
        min="0"
        // `step="0.5"` also made 0.25 a `stepMismatch`, which the browser
        // refuses to submit; the weight is validated server-side.
        step="any"
        inputMode="decimal"
        placeholder="–"
        aria-label={`${label}, set ${n} weight in kg`}
        value={set.weight_kg}
        onChange={e => onChange('weight_kg', e.target.value)}
        style={numberInput}
      />
      <span aria-hidden="true" style={{ fontSize: 15, color: 'var(--muted)', textAlign: 'center' }}>×</span>
      <input
        className="input-field"
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        placeholder="–"
        aria-label={`${label}, set ${n} reps`}
        value={set.reps}
        onChange={e => onChange('reps', e.target.value)}
        style={numberInput}
      />
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove set ${n} of ${label}`} style={iconBtn}>
          <CloseIcon size={18} />
        </button>
      ) : <span aria-hidden="true" />}
    </>
  )
}
