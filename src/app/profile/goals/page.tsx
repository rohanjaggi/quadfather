'use client'

import { useState, useEffect, useMemo, type FormEvent } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { calculateTargets, type Sex, type ActivityLevel, type FitnessGoal } from '@/lib/tdee'
import { errorMessage } from '@/lib/errors'
import type { User } from '@/types/api'
import PageHeader from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import { toast } from '@/components/ui/Toast'
import { FormCard, NumberField, SaveBar } from '@/components/settings/ui'
import { checkNumber, parseNumber, type NumberRule } from '@/components/settings/validate'

type Key = 'calories' | 'protein' | 'carbs' | 'fats' | 'fiber' | 'water' | 'bottle' | 'steps'

const FIELDS: Record<Key, { label: string; unit: string; rule: NumberRule }> = {
  calories: { label: 'Calories', unit: 'kcal', rule: { min: 1000, max: 6000 } },
  protein: { label: 'Protein', unit: 'g', rule: { min: 20, max: 400 } },
  carbs: { label: 'Carbs', unit: 'g', rule: { min: 0, max: 800 } },
  fats: { label: 'Fats', unit: 'g', rule: { min: 10, max: 300 } },
  fiber: { label: 'Fibre', unit: 'g', rule: { min: 0, max: 100 } },
  water: { label: 'Daily water', unit: 'L', rule: { min: 0.5, max: 8, decimal: true } },
  bottle: { label: 'Bottle size', unit: 'L', rule: { min: 0.1, max: 5, decimal: true } },
  steps: { label: 'Daily steps', unit: 'steps', rule: { min: 1000, max: 50000, integer: true } },
}

type Focus = '' | 'strength' | 'hypertrophy'

const FOCUS_OPTIONS: { value: Focus; label: string }[] = [
  { value: '', label: 'General' },
  { value: 'strength', label: 'Strength' },
  { value: 'hypertrophy', label: 'Muscle' },
]

const FOCUS_HINT: Record<Focus, string> = {
  '': 'Balanced suggestions for overall fitness.',
  strength: 'Suggestions push the weight up over time.',
  hypertrophy: 'Suggestions push sets and reps up over time.',
}

type Values = Record<Key, string> & { focus: Focus }

function fromUser(u: User): Values {
  return {
    calories: String(u.goals.daily_calorie_goal),
    protein: String(u.goals.daily_protein_goal),
    carbs: String(u.goals.daily_carbs_goal),
    fats: String(u.goals.daily_fats_goal),
    fiber: String(u.goals.daily_fiber_goal),
    water: String(u.goals.daily_water_goal),
    bottle: String(u.water_bottle_size),
    steps: String(u.goals.daily_step_goal),
    focus: (u.training_focus ?? '') as Focus,
  }
}

export default function GoalsPage() {
  const { user, updateGoals } = useUser()
  const saved = useMemo(() => (user ? fromUser(user) : null), [user])
  const [vals, setVals] = useState<Values | null>(saved)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  // A refreshed user (after saving) resets the form to what the server holds.
  useEffect(() => { if (saved) setVals(saved) }, [saved])

  if (!user || !vals || !saved) return null

  const set = (patch: Partial<Values>) => setVals(v => (v ? { ...v, ...patch } : v))
  const errors = Object.fromEntries(
    (Object.keys(FIELDS) as Key[]).map(k => [k, checkNumber(vals[k], FIELDS[k].rule)]),
  ) as Record<Key, string | null>
  const invalid = Object.values(errors).some(Boolean)
  const dirty = (Object.keys(vals) as (keyof Values)[]).some(k => vals[k] !== saved[k])

  const p = user.personal
  const canGenerate = !!(p?.sex && p.weight_kg && p.height_cm && p.age && p.activity_level && p.fitness_goal)

  function handleGenerate() {
    if (!p) return
    const t = calculateTargets({
      sex: p.sex as Sex,
      weight_kg: p.weight_kg,
      height_cm: p.height_cm,
      age: p.age,
      activity_level: p.activity_level as ActivityLevel,
      fitness_goal: p.fitness_goal as FitnessGoal,
    })
    set({
      calories: String(t.calories),
      protein: String(t.protein),
      carbs: String(t.carbohydrates),
      fats: String(t.fats),
      fiber: String(t.fiber),
    })
    setGenerated(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!vals || invalid || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateGoals({
        daily_calorie_goal: parseNumber(vals.calories),
        daily_protein_goal: parseNumber(vals.protein),
        daily_carbs_goal: parseNumber(vals.carbs),
        daily_fats_goal: parseNumber(vals.fats),
        daily_fiber_goal: parseNumber(vals.fiber),
        daily_water_goal: parseNumber(vals.water, true),
        daily_step_goal: parseNumber(vals.steps),
        water_bottle_size: parseNumber(vals.bottle, true),
        training_focus: vals.focus || null,
      } as Parameters<typeof updateGoals>[0] & { training_focus: string | null })
      setGenerated(false)
      toast('Goals saved', { type: 'success' })
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save your goals. Try again."))
    } finally {
      setSaving(false)
    }
  }

  const field = (k: Key) => (
    <NumberField
      id={`goal-${k}`}
      label={FIELDS[k].label}
      unit={FIELDS[k].unit}
      value={vals[k]}
      onChange={v => set({ [k]: v } as Partial<Values>)}
      error={errors[k]}
      decimal={FIELDS[k].rule.decimal}
    />
  )

  return (
    <div>
      <PageHeader title="Daily goals" back={{ href: '/profile', label: 'Settings' }} />

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section className="card">
          <h2 className="card-title" style={{ margin: '0 0 4px' }}>Recommended goals</h2>
          {canGenerate ? (
            <>
              <p style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--muted)' }}>
                {generated
                  ? 'Filled in from your details. Check them, then save.'
                  : 'Fill in food goals worked out from your body, activity and aim.'}
              </p>
              <button type="button" className="btn-secondary" onClick={handleGenerate} style={{ width: '100%' }}>
                Use recommended goals
              </button>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Estimated with the Mifflin-St Jeor formula. Adjust to suit you.
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--muted)' }}>
                Add your personal details and we can suggest goals for you.
              </p>
              <Link href="/profile/personal" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                Add personal details
              </Link>
            </>
          )}
        </section>

        <FormCard title="Food">
          {field('calories')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('protein')}
            {field('carbs')}
            {field('fats')}
            {field('fiber')}
          </div>
        </FormCard>

        <FormCard title="Water" id="water">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('water')}
            {field('bottle')}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Bottle size is how much one tap on the water button logs.
          </p>
        </FormCard>

        <FormCard title="Activity">
          {field('steps')}
          <div>
            <p className="label-caps" aria-hidden="true">Training focus</p>
            <Segmented label="Training focus" options={FOCUS_OPTIONS} value={vals.focus} onChange={focus => set({ focus })} />
            <p style={{ margin: '8px 2px 0', fontSize: 13, color: 'var(--muted)' }}>{FOCUS_HINT[vals.focus]}</p>
          </div>
        </FormCard>

        <SaveBar dirty={dirty} invalid={invalid} saving={saving} label="Save goals" error={saveError} />
      </form>
    </div>
  )
}
