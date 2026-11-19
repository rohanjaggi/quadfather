'use client'

import { useId, useState, type FormEvent } from 'react'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { errorMessage } from '@/lib/errors'

/** A meal's name and macros, validated and parsed. */
export interface FoodValues {
  food_name: string
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
}

type NumericField = 'calories' | 'protein' | 'carbohydrates' | 'fats' | 'fiber' | 'servings'

const FIELDS: { key: Exclude<NumericField, 'servings'>; label: string }[] = [
  { key: 'calories', label: 'Calories (kcal)' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'carbohydrates', label: 'Carbs (g)' },
  { key: 'fats', label: 'Fat (g)' },
  { key: 'fiber', label: 'Fibre (g)' },
]

/** `''`, `'.'`, `'-'` and other partial input parse to `fallback`, not to NaN. */
function toNumber(raw: string, fallback: number): number {
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

const hint: React.CSSProperties = { margin: 0, fontSize: 13, color: 'var(--muted)' }

/**
 * Name + macros form. By default it logs the meal (with servings). Given
 * `onApply` it hands the values back instead and hides servings: used to edit
 * an AI estimate before logging, and to edit a saved food.
 *
 * Numeric inputs keep the RAW STRING the user typed and are parsed once, on
 * submit. Parsing on every keystroke made intermediate states unrepresentable:
 * `parseFloat('0.') || 0` collapsed to `0`, so 0.5 servings could not be typed,
 * and a cleared servings box silently POSTed `servings: 0`.
 */
export default function ManualFoodForm({
  onClose,
  initial,
  onApply,
  submitLabel,
}: {
  /** Log mode: called once the meal is logged. */
  onClose?: () => void
  initial?: Partial<FoodValues>
  onApply?: (values: FoodValues) => void | Promise<void>
  submitLabel?: string
}) {
  const { logFood } = useUser()
  const haptic = useHaptic()
  const id = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [foodName, setFoodName] = useState(initial?.food_name ?? '')
  const [numeric, setNumeric] = useState<Record<NumericField, string>>(() => ({
    calories: initial?.calories != null ? String(initial.calories) : '',
    protein: initial?.protein != null ? String(initial.protein) : '',
    carbohydrates: initial?.carbohydrates != null ? String(initial.carbohydrates) : '',
    fats: initial?.fats != null ? String(initial.fats) : '',
    fiber: initial?.fiber != null ? String(initial.fiber) : '',
    servings: '1',
  }))

  function handleNumericChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setNumeric(prev => ({ ...prev, [name as NumericField]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    const name = foodName.trim()
    if (!name) {
      setError('Give this meal a name')
      return
    }

    const values: FoodValues = {
      food_name: name,
      calories: Math.max(toNumber(numeric.calories, 0), 0),
      protein: Math.max(toNumber(numeric.protein, 0), 0),
      carbohydrates: Math.max(toNumber(numeric.carbohydrates, 0), 0),
      fats: Math.max(toNumber(numeric.fats, 0), 0),
      fiber: Math.max(toNumber(numeric.fiber, 0), 0),
    }

    if (onApply) {
      setSaving(true)
      setError(null)
      try {
        await onApply(values)
      } catch (err) {
        setError(errorMessage(err, 'Could not save changes'))
      } finally {
        setSaving(false)
      }
      return
    }

    // An empty servings box means "one serving", never zero. The API rejects
    // `servings <= 0`, and a zero would scale every macro to nothing anyway.
    const servings = toNumber(numeric.servings, 1)
    if (!(servings > 0)) {
      setError('Servings must be greater than 0')
      return
    }

    setSaving(true)
    setError(null)
    let logged = false
    try {
      await logFood({ ...values, servings })
      logged = true
    } catch (err) {
      setError(errorMessage(err, 'Could not save this meal'))
      haptic.notification('error')
    } finally {
      setSaving(false)
    }
    if (logged) {
      haptic.notification('success')
      onClose?.()
    }
  }

  const numberInput = (key: NumericField, placeholder: string) => (
    <input
      id={`${id}-${key}`}
      name={key}
      type="number"
      min="0"
      step="any"
      inputMode="decimal"
      value={numeric[key]}
      onChange={handleNumericChange}
      placeholder={placeholder}
      className="input-field"
    />
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label htmlFor={`${id}-name`} className="label-caps">Food name</label>
        <input
          id={`${id}-name`}
          type="text"
          value={foodName}
          onChange={e => setFoodName(e.target.value)}
          placeholder="Chicken rice"
          required
          className="input-field"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label htmlFor={`${id}-${f.key}`} className="label-caps">{f.label}</label>
            {numberInput(f.key, '0')}
          </div>
        ))}
        {!onApply && (
          <div>
            <label htmlFor={`${id}-servings`} className="label-caps">Servings</label>
            {numberInput('servings', '1')}
          </div>
        )}
      </div>

      {!onApply && <p style={hint}>Leave servings blank for one. Fractions like 0.5 are fine.</p>}

      {error && <p role="alert" style={{ ...hint, color: 'var(--over)' }}>{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: 4 }}>
        {saving ? 'Saving…' : submitLabel ?? 'Log meal'}
      </button>
    </form>
  )
}
