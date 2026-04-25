'use client'

import { useState, FormEvent } from 'react'
import { useUser } from '@/context/UserContext'
import type { FoodLogCreate } from '@/types/api'

interface ManualFoodFormProps {
  onClose: () => void
}

export default function ManualFoodForm({ onClose }: ManualFoodFormProps) {
  const { logFood } = useUser()
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
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--surface-border)',
    backgroundColor: 'var(--tg-theme-bg-color)',
    color: 'var(--tg-theme-text-color)',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--tg-theme-hint-color)',
    marginBottom: '5px',
    display: 'block',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label htmlFor="food_name" style={labelStyle}>Food name</label>
        <input
          id="food_name"
          name="food_name"
          type="text"
          value={fields.food_name}
          onChange={handleChange}
          placeholder="e.g. Chicken breast"
          required
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label htmlFor="calories" style={labelStyle}>Calories</label>
          <input
            id="calories"
            name="calories"
            type="number"
            min="0"
            step="1"
            value={fields.calories || ''}
            onChange={handleChange}
            placeholder="0"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="protein" style={labelStyle}>Protein (g)</label>
          <input
            id="protein"
            name="protein"
            type="number"
            min="0"
            step="0.1"
            value={fields.protein || ''}
            onChange={handleChange}
            placeholder="0"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="carbohydrates" style={labelStyle}>Carbs (g)</label>
          <input
            id="carbohydrates"
            name="carbohydrates"
            type="number"
            min="0"
            step="0.1"
            value={fields.carbohydrates || ''}
            onChange={handleChange}
            placeholder="0"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="fats" style={labelStyle}>Fats (g)</label>
          <input
            id="fats"
            name="fats"
            type="number"
            min="0"
            step="0.1"
            value={fields.fats || ''}
            onChange={handleChange}
            placeholder="0"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label htmlFor="servings" style={labelStyle}>Servings</label>
        <input
          id="servings"
          name="servings"
          type="number"
          min="0.5"
          step="0.5"
          value={fields.servings || ''}
          onChange={handleChange}
          placeholder="1"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--surface-border)',
            backgroundColor: 'transparent',
            color: 'var(--tg-theme-hint-color)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: 'var(--tg-theme-button-color)',
            color: 'var(--tg-theme-button-text-color)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
