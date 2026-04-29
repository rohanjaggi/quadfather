'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { calculateTargets, type Sex, type ActivityLevel, type FitnessGoal } from '@/lib/tdee'

export default function GoalsPage() {
  const { user, updateGoals } = useUser()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')
  const [fiber, setFiber] = useState('')
  const [water, setWater] = useState('')
  const [bottleSize, setBottleSize] = useState('')

  const canGenerate = !!(
    user?.personal?.sex &&
    user?.personal?.weight_kg &&
    user?.personal?.height_cm &&
    user?.personal?.age &&
    user?.personal?.activity_level &&
    user?.personal?.fitness_goal
  )

  useEffect(() => {
    if (user) {
      setCalories(String(user.goals.daily_calorie_goal))
      setProtein(String(user.goals.daily_protein_goal))
      setCarbs(String(user.goals.daily_carbs_goal))
      setFats(String(user.goals.daily_fats_goal))
      setFiber(String(user.goals.daily_fiber_goal))
      setWater(String(user.goals.daily_water_goal))
      setBottleSize(String(user.water_bottle_size))
    }
  }, [user])

  function handleGenerate() {
    if (!user?.personal) return
    setGenerating(true)
    try {
      const targets = calculateTargets({
        sex: user.personal.sex as Sex,
        weight_kg: user.personal.weight_kg,
        height_cm: user.personal.height_cm,
        age: user.personal.age,
        activity_level: user.personal.activity_level as ActivityLevel,
        fitness_goal: user.personal.fitness_goal as FitnessGoal,
      })
      setCalories(String(targets.calories))
      setProtein(String(targets.protein))
      setCarbs(String(targets.carbohydrates))
      setFats(String(targets.fats))
      setFiber(String(targets.fiber))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateGoals({
        daily_calorie_goal: parseFloat(calories),
        daily_protein_goal: parseFloat(protein),
        daily_carbs_goal: parseFloat(carbs),
        daily_fats_goal: parseFloat(fats),
        daily_fiber_goal: parseFloat(fiber),
        daily_water_goal: parseFloat(water),
        water_bottle_size: parseFloat(bottleSize),
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
          Daily Goals
        </h1>
      </div>

      {/* Generate Goals card */}
      <div className="card fade-up fade-up-1">
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '11px',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '8px',
        }}>
          Smart Generation
        </p>
        {canGenerate ? (
          <>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '13px',
              color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
            }}>
              Calculate targets from your personal info using TDEE.
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Calculating…' : 'Generate Goals'}
            </button>
          </>
        ) : (
          <>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '13px',
              color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
            }}>
              Set your personal info first to auto-generate goals.
            </p>
            <Link href="/profile/personal" style={{ textDecoration: 'none' }}>
              <button type="button" className="btn-secondary">
                Add Personal Info
              </button>
            </Link>
          </>
        )}
      </div>

      {/* Goals form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div className="fade-up fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Calories */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label style={labelStyle}>Calories</label>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>kcal</span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={calories}
              onChange={e => setCalories(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {/* Protein */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label style={labelStyle}>Protein</label>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={protein}
              onChange={e => setProtein(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {/* Carbs */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label style={labelStyle}>Carbohydrates</label>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={carbs}
              onChange={e => setCarbs(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {/* Fats */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label style={labelStyle}>Fats</label>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={fats}
              onChange={e => setFats(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {/* Fiber */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label style={labelStyle}>Fiber</label>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={fiber}
              onChange={e => setFiber(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {/* Water */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label style={labelStyle}>Daily Water</label>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>L</span>
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={water}
              onChange={e => setWater(e.target.value)}
              required
              className="input-field"
            />
          </div>

          {/* Bottle Size */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label style={labelStyle}>Bottle Size</label>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>L</span>
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={bottleSize}
              onChange={e => setBottleSize(e.target.value)}
              required
              className="input-field"
            />
          </div>
        </div>

        <div className="fade-up fade-up-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{
              backgroundColor: saved ? 'var(--accent-protein)' : undefined,
            }}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Goals'}
          </button>
        </div>

      </form>
    </div>
  )
}
