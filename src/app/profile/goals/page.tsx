'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { calculateTargets, type Sex, type ActivityLevel, type FitnessGoal } from '@/lib/tdee'
import { errorMessage } from '@/lib/errors'

export default function GoalsPage() {
  const { user, updateGoals } = useUser()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')
  const [fiber, setFiber] = useState('')
  const [water, setWater] = useState('')
  const [bottleSize, setBottleSize] = useState('')
  const [stepGoal, setStepGoal] = useState('')
  const [trainingFocus, setTrainingFocus] = useState('')

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
      setStepGoal(String(user.goals.daily_step_goal))
      setTrainingFocus((user as unknown as { training_focus?: string }).training_focus ?? '')
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
    setSaveError(null)
    try {
      await updateGoals({
        daily_calorie_goal: parseFloat(calories),
        daily_protein_goal: parseFloat(protein),
        daily_carbs_goal: parseFloat(carbs),
        daily_fats_goal: parseFloat(fats),
        daily_fiber_goal: parseFloat(fiber),
        daily_water_goal: parseFloat(water),
        daily_step_goal: parseInt(stepGoal),
        water_bottle_size: parseFloat(bottleSize),
        training_focus: trainingFocus || null,
      } as Parameters<typeof updateGoals>[0] & { training_focus: string | null })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save goals'))
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
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
          Daily Goals
        </h1>
      </div>

      {/* Generate Goals card */}
      <div className="card fade-up fade-up-1">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '11px',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '8px',
        }}>
          Smart Generation
        </p>
        {canGenerate ? (
          <>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '13px',
              color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
            }}>
              Calculate targets from your personal info using TDEE. These are estimates based on the Mifflin-St Jeor equation and general guidelines — adjust to suit your needs.
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
              fontFamily: 'var(--font-display)', fontSize: '13px',
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
              <label htmlFor="goal-calories" style={labelStyle}>Calories</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>kcal</span>
            </div>
            <input
              id="goal-calories"
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
              <label htmlFor="goal-protein" style={labelStyle}>Protein</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              id="goal-protein"
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
              <label htmlFor="goal-carbs" style={labelStyle}>Carbohydrates</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              id="goal-carbs"
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
              <label htmlFor="goal-fats" style={labelStyle}>Fats</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              id="goal-fats"
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
              <label htmlFor="goal-fiber" style={labelStyle}>Fiber</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>g</span>
            </div>
            <input
              id="goal-fiber"
              type="number"
              min="0"
              step="1"
              value={fiber}
              onChange={e => setFiber(e.target.value)}
              required
              className="input-field"
            />
          </div>

        </div>

        {/* Water section */}
        <div className="fade-up fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)', marginBottom: '-4px',
          }}>
            Hydration
          </p>

          {/* Water */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label htmlFor="goal-water" style={labelStyle}>Daily Water</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>L</span>
            </div>
            <input
              id="goal-water"
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
              <label htmlFor="goal-bottle-size" style={labelStyle}>Bottle Size</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>L</span>
            </div>
            <input
              id="goal-bottle-size"
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

        {/* Steps section */}
        <div className="fade-up fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)', marginBottom: '-4px',
          }}>
            Activity
          </p>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <label htmlFor="goal-steps" style={labelStyle}>Daily Step Goal</label>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>steps</span>
            </div>
            <input
              id="goal-steps"
              type="number"
              min="0"
              step="500"
              value={stepGoal}
              onChange={e => setStepGoal(e.target.value)}
              required
              className="input-field"
            />
          </div>
        </div>

        {/* Training focus section */}
        <div className="fade-up fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '11px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)', marginBottom: '-4px',
          }}>
            Training
          </p>
          <div>
            <label htmlFor="goal-training-focus" className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Training Focus</label>
            <select
              id="goal-training-focus"
              className="input-field"
              value={trainingFocus}
              onChange={e => setTrainingFocus(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">General Fitness</option>
              <option value="strength">Strength (weight progression)</option>
              <option value="hypertrophy">Hypertrophy (volume progression)</option>
            </select>
          </div>
        </div>

        <div className="fade-up fade-up-3" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {saveError && (
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '12px',
              color: 'var(--accent-calories)', padding: '10px 14px',
              backgroundColor: 'oklch(0.94 0.02 30)',
              borderRadius: '10px',
            }}>
              {saveError}
            </p>
          )}
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
