'use client'

import { useState, FormEvent } from 'react'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/TelegramProvider'
import type { FoodLogCreate } from '@/types/api'

interface ManualFoodFormProps {
  onClose: () => void
}

export default function ManualFoodForm({ onClose }: ManualFoodFormProps) {
  const { logFood } = useUser()
  const haptic = useHaptic()
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState<FoodLogCreate>({
    food_name: '',
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fats: 0,
    servings: 1,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFields((prev) => ({
      ...prev,
      [name]: name === 'food_name' ? value : parseFloat(value) || 0,
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!fields.food_name.trim()) return
    setSaving(true)
    try {
      await logFood(fields)
      haptic.notification('success')
      onClose()
    } finally {
      setSaving(false)
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
          value={fields.food_name}
          onChange={handleChange}
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
            step="1"
            value={fields.calories || ''}
            onChange={handleChange}
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
            step="0.1"
            value={fields.protein || ''}
            onChange={handleChange}
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
            step="0.1"
            value={fields.carbohydrates || ''}
            onChange={handleChange}
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
            step="0.1"
            value={fields.fats || ''}
            onChange={handleChange}
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
          min="0.5"
          step="0.5"
          value={fields.servings || ''}
          onChange={handleChange}
          placeholder="1"
          className="input-field-bordered"
        />
      </div>

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
