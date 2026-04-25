'use client'

import { useState, useEffect, FormEvent } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'

export default function ProfilePage() {
  const { user, updateGoals } = useUser()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    daily_calorie_goal: '',
    daily_protein_goal: '',
    daily_water_goal: '',
    water_bottle_size: '',
  })

  useEffect(() => {
    if (user) {
      setForm({
        daily_calorie_goal: String(user.goals.daily_calorie_goal),
        daily_protein_goal: String(user.goals.daily_protein_goal),
        daily_water_goal: String(user.goals.daily_water_goal),
        water_bottle_size: String(user.water_bottle_size),
      })
    }
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateGoals({
        daily_calorie_goal: parseFloat(form.daily_calorie_goal),
        daily_protein_goal: parseFloat(form.daily_protein_goal),
        daily_water_goal: parseFloat(form.daily_water_goal),
        water_bottle_size: parseFloat(form.water_bottle_size),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: 'daily_calorie_goal', label: 'Daily Calories', unit: 'kcal', step: '50' },
    { key: 'daily_protein_goal', label: 'Daily Protein', unit: 'g', step: '5' },
    { key: 'daily_water_goal', label: 'Daily Water', unit: 'L', step: '0.5' },
    { key: 'water_bottle_size', label: 'Bottle Size', unit: 'L', step: '0.1' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up">
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '5px',
        }}>
          Settings
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          fontWeight: 400,
          lineHeight: 1.1,
          color: 'var(--tg-theme-text-color)',
        }}>
          Your Goals
        </h1>
      </div>

      <div className="fade-up fade-up-1">
        <SummaryCard title="Daily Targets">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {fields.map(({ key, label, unit, step }) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <label style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--tg-theme-text-color)',
                  }}>
                    {label}
                  </label>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--tg-theme-hint-color)',
                    letterSpacing: '0.04em',
                  }}>
                    {unit}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step={step}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '15px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 400,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'var(--tg-theme-bg-color)',
                    color: 'var(--tg-theme-text-color)',
                  }}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: saved ? 'var(--accent-protein)' : 'var(--tg-theme-button-color)',
                color: 'var(--tg-theme-button-text-color)',
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                opacity: saving ? 0.5 : 1,
                transition: 'background-color 0.3s ease, opacity 0.2s ease',
                cursor: saving ? 'not-allowed' : 'pointer',
                marginTop: '4px',
              }}
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Goals'}
            </button>
          </form>
        </SummaryCard>
      </div>

    </div>
  )
}
