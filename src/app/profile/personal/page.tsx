'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  type Sex,
  type ActivityLevel,
  type FitnessGoal,
} from '@/lib/tdee'
import { ACTIVITY_BASELINE_LABELS } from '@/lib/steps'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]
const GOAL_OPTIONS = Object.entries(GOAL_LABELS) as [FitnessGoal, string][]

const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: 'Desk job, little to no exercise',
  lightly_active: 'Light exercise 1–3 days/week',
  moderately_active: 'Moderate exercise 3–5 days/week',
  very_active: 'Hard exercise 6–7 days/week',
  extra_active: 'Intense training or physical job',
}

const GOAL_DESCRIPTIONS: Record<FitnessGoal, string> = {
  aggressive_cut: '−750 kcal/day',
  moderate_cut: '−500 kcal/day',
  mild_cut: '−250 kcal/day',
  maintenance: 'No change',
  lean_bulk: '+250 kcal/day',
  moderate_bulk: '+500 kcal/day',
}

const DIETARY_RESTRICTIONS: { value: string; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'gluten_free', label: 'Gluten-Free' },
  { value: 'dairy_free', label: 'Dairy-Free' },
  { value: 'nut_free', label: 'Nut-Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'low_carb', label: 'Low Carb' },
  { value: 'keto', label: 'Keto' },
  { value: 'oil_free', label: 'Oil-Free' },
]

export default function PersonalPage() {
  const { user, updatePersonal } = useUser()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [sex, setSex] = useState<Sex>('male')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [age, setAge] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderately_active')
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>('maintenance')
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [restrictionsOpen, setRestrictionsOpen] = useState(false)

  useEffect(() => {
    if (user?.personal) {
      setSex(user.personal.sex as Sex)
      setWeight(String(user.personal.weight_kg))
      setHeight(String(user.personal.height_cm))
      setAge(String(user.personal.age))
      setActivityLevel(user.personal.activity_level as ActivityLevel)
      setFitnessGoal(user.personal.fitness_goal as FitnessGoal)
    }
    if (user) {
      setDietaryRestrictions(user.dietary_restrictions ?? [])
    }
  }, [user])

  function toggleRestriction(value: string) {
    setDietaryRestrictions(prev =>
      prev.includes(value)
        ? prev.filter(r => r !== value)
        : [...prev, value]
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updatePersonal({
        sex,
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
        age: parseInt(age, 10),
        activity_level: activityLevel,
        fitness_goal: fitnessGoal,
        dietary_restrictions: dietaryRestrictions,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--tg-theme-text-color)',
    display: 'block',
    marginBottom: '8px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Back link */}
      <div className="fade-up">
        <Link href="/profile" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Settings
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px',
          fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>
          Personal Info
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Sex */}
        <div className="fade-up fade-up-1">
          <label style={labelStyle}>Sex</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {SEX_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className="btn-pill"
                data-active={sex === o.value ? 'true' : undefined}
                onClick={() => setSex(o.value)}
                style={{ flex: 1 }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Weight / Height / Age */}
        <div className="fade-up fade-up-2">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Weight</label>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>kg</span>
              </div>
              <input
                type="number"
                min="20"
                max="300"
                step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                required
                className="input-field-bordered"
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Height</label>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>cm</span>
              </div>
              <input
                type="number"
                min="100"
                max="250"
                step="1"
                value={height}
                onChange={e => setHeight(e.target.value)}
                required
                className="input-field-bordered"
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Age</label>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>yr</span>
              </div>
              <input
                type="number"
                min="10"
                max="120"
                step="1"
                value={age}
                onChange={e => setAge(e.target.value)}
                required
                className="input-field-bordered"
              />
            </div>
          </div>
        </div>

        {/* Activity Level */}
        <div className="fade-up fade-up-3">
          <label style={labelStyle}>Activity Level</label>
          <div className="option-group">
            {ACTIVITY_OPTIONS.map(([value, label], i) => (
              <button
                key={value}
                type="button"
                className="option-group-item"
                data-active={activityLevel === value ? 'true' : undefined}
                onClick={() => setActivityLevel(value)}
                style={i < ACTIVITY_OPTIONS.length - 1 ? { borderBottom: '1px solid var(--surface-border)' } : undefined}
              >
                <span>{label}</span>
                <span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 400 }}>
                  {ACTIVITY_DESCRIPTIONS[value]}
                </span>
              </button>
            ))}
          </div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            color: 'var(--accent-steps)',
            marginTop: '8px',
          }}>
            Assumes {ACTIVITY_BASELINE_LABELS[activityLevel]}
          </p>
        </div>

        {/* Fitness Goal */}
        <div className="fade-up fade-up-4">
          <label style={labelStyle}>Fitness Goal</label>
          <div className="option-group">
            {GOAL_OPTIONS.map(([value, label], i) => (
              <button
                key={value}
                type="button"
                className="option-group-item"
                data-active={fitnessGoal === value ? 'true' : undefined}
                onClick={() => setFitnessGoal(value)}
                style={i < GOAL_OPTIONS.length - 1 ? { borderBottom: '1px solid var(--surface-border)' } : undefined}
              >
                <span>{label}</span>
                <span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 400 }}>
                  {GOAL_DESCRIPTIONS[value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Dietary Restrictions — collapsible */}
        <div className="fade-up fade-up-4">
          <div className="option-group">
            <button
              type="button"
              className="option-group-item"
              onClick={() => setRestrictionsOpen(prev => !prev)}
              style={{ borderBottom: restrictionsOpen ? '1px solid var(--surface-border)' : undefined }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 500 }}>Dietary Restrictions</span>
                <span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 400 }}>
                  {dietaryRestrictions.length > 0
                    ? DIETARY_RESTRICTIONS.filter(r => dietaryRestrictions.includes(r.value)).map(r => r.label).join(', ')
                    : 'Select all that apply'}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {dietaryRestrictions.length > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                    backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)',
                    borderRadius: '99px', padding: '2px 7px',
                  }}>
                    {dietaryRestrictions.length}
                  </span>
                )}
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    transform: restrictionsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    opacity: 0.5,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            <div style={{
              display: 'grid',
              gridTemplateRows: restrictionsOpen ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.3s ease',
            }}>
              <div style={{ overflow: 'hidden' }}>
                {DIETARY_RESTRICTIONS.map((r, i) => (
                  <button
                    key={r.value}
                    type="button"
                    className="option-group-item"
                    data-active={dietaryRestrictions.includes(r.value) ? 'true' : undefined}
                    onClick={() => toggleRestriction(r.value)}
                    style={i < DIETARY_RESTRICTIONS.length - 1 ? { borderBottom: '1px solid var(--surface-border)' } : undefined}
                  >
                    <span>{r.label}</span>
                    {dietaryRestrictions.includes(r.value) && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="fade-up fade-up-5">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{
              backgroundColor: saved ? 'var(--accent-protein)' : undefined,
            }}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Info'}
          </button>
        </div>

      </form>
    </div>
  )
}
