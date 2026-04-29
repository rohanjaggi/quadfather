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

  useEffect(() => {
    if (user?.personal) {
      setSex(user.personal.sex as Sex)
      setWeight(String(user.personal.weight_kg))
      setHeight(String(user.personal.height_cm))
      setAge(String(user.personal.age))
      setActivityLevel(user.personal.activity_level as ActivityLevel)
      setFitnessGoal(user.personal.fitness_goal as FitnessGoal)
    }
  }, [user])

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
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
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
          fontFamily: 'var(--font-body)', fontSize: '13px',
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
          fontWeight: 400, lineHeight: 1.1, color: 'var(--tg-theme-text-color)',
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
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>kg</span>
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
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>cm</span>
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
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>yr</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ACTIVITY_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="btn-pill"
                data-active={activityLevel === value ? 'true' : undefined}
                onClick={() => setActivityLevel(value)}
                style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>{label}</span>
                <span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 400 }}>
                  {ACTIVITY_DESCRIPTIONS[value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Fitness Goal */}
        <div className="fade-up fade-up-4">
          <label style={labelStyle}>Fitness Goal</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {GOAL_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="btn-pill"
                data-active={fitnessGoal === value ? 'true' : undefined}
                onClick={() => setFitnessGoal(value)}
                style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>{label}</span>
                <span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 400 }}>
                  {GOAL_DESCRIPTIONS[value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="fade-up fade-up-4">
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
