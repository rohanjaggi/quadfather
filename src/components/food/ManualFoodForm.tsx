'use client'

import { useState, FormEvent } from 'react'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/TelegramProvider'
import { errorMessage } from '@/components/ui/Toast'

interface ManualFoodFormProps {
  onClose: () => void
}

type NumericField = 'calories' | 'protein' | 'carbohydrates' | 'fats' | 'fiber' | 'servings'

/**
 * Numeric inputs keep the RAW STRING the user typed and are parsed once, on
 * submit. Parsing on every keystroke made intermediate states unrepresentable:
 * `parseFloat('0.') || 0` collapsed to `0`, and the field rendered `value={x || ''}`
 * so typing "0" (on the way to "0.5") blanked the box — 0.5 servings could not
 * be entered at all, and a cleared servings box silently POSTed `servings: 0`,
 * which zeroes every macro on the row.
 */
const INITIAL_NUMERIC: Record<NumericField, string> = {
  calories: '',
  protein: '',
  carbohydrates: '',
  fats: '',
  fiber: '',
  servings: '1',
}

/** `''`, `'.'`, `'-'` and other partial input parse to `fallback`, not to NaN. */
function toNumber(raw: string, fallback: number): number {
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default function ManualFoodForm({ onClose }: ManualFoodFormProps) {
  const { logFood } = useUser()
  const haptic = useHaptic()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [foodName, setFoodName] = useState('')
  const [numeric, setNumeric] = useState<Record<NumericField, string>>(INITIAL_NUMERIC)

  function handleNumericChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setNumeric((prev) => ({ ...prev, [name as NumericField]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return

    const name = foodName.trim()
    if (!name) {
      setError('Give this meal a name')
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
      await logFood({
        food_name: name,
        calories: Math.max(toNumber(numeric.calories, 0), 0),
        protein: Math.max(toNumber(numeric.protein, 0), 0),
        carbohydrates: Math.max(toNumber(numeric.carbohydrates, 0), 0),
        fats: Math.max(toNumber(numeric.fats, 0), 0),
        fiber: Math.max(toNumber(numeric.fiber, 0), 0),
        servings,
      })
      logged = true
    } catch (err) {
      setError(errorMessage(err, 'Could not save this meal'))
      haptic.notification('error')
    } finally {
      setSaving(false)
    }
    if (logged) {
      haptic.notification('success')
      onClose()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label htmlFor="food_name" className="label-caps">Food name</label>
        <input
          id="food_name"
          name="food_name"
          type="text"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          placeholder="e.g. Chicken breast"
          required
          className="input-field-bordered"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label htmlFor="calories" className="label-caps">Calories</label>
          <input
            id="calories"
            name="calories"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={numeric.calories}
            onChange={handleNumericChange}
            placeholder="0"
            className="input-field-bordered"
          />
        </div>
        <div>
          <label htmlFor="protein" className="label-caps">Protein (g)</label>
          <input
            id="protein"
            name="protein"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={numeric.protein}
            onChange={handleNumericChange}
            placeholder="0"
            className="input-field-bordered"
          />
        </div>
        <div>
          <label htmlFor="carbohydrates" className="label-caps">Carbs (g)</label>
          <input
            id="carbohydrates"
            name="carbohydrates"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={numeric.carbohydrates}
            onChange={handleNumericChange}
            placeholder="0"
            className="input-field-bordered"
          />
        </div>
        <div>
          <label htmlFor="fats" className="label-caps">Fats (g)</label>
          <input
            id="fats"
            name="fats"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={numeric.fats}
            onChange={handleNumericChange}
            placeholder="0"
            className="input-field-bordered"
          />
        </div>
        <div>
          <label htmlFor="fiber" className="label-caps">Fiber (g)</label>
          <input
            id="fiber"
            name="fiber"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={numeric.fiber}
            onChange={handleNumericChange}
            placeholder="0"
            className="input-field-bordered"
          />
        </div>
      </div>

      <div>
        <label htmlFor="servings" className="label-caps">Servings</label>
        <input
          id="servings"
          name="servings"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={numeric.servings}
          onChange={handleNumericChange}
          placeholder="1"
          className="input-field-bordered"
        />
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '11px',
          color: 'var(--tg-theme-hint-color)', marginTop: '4px',
        }}>
          Leave blank for one serving. Fractions like 0.5 are fine.
        </p>
      </div>

      {error && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          color: 'var(--accent-calories)', paddingLeft: '4px',
        }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
