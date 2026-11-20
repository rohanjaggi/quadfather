'use client'

import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { useUser } from '@/context/UserContext'
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  type Sex,
  type ActivityLevel,
  type FitnessGoal,
} from '@/lib/tdee'
import { ACTIVITY_BASELINE_LABELS } from '@/lib/steps'
import { errorMessage } from '@/lib/errors'
import type { User } from '@/types/api'
import PageHeader from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import { toast } from '@/components/ui/Toast'
import { CheckIcon } from '@/components/ui/icons'
import { ChoiceList, FormCard, NumberField, SaveBar, sentence } from '@/components/settings/ui'
import { checkNumber, parseNumber, type NumberRule } from '@/components/settings/validate'
import { DIETARY_RESTRICTIONS } from '@/components/settings/diet'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const ACTIVITY_HINTS: Record<ActivityLevel, string> = {
  sedentary: 'Desk job, drive everywhere',
  lightly_active: 'On your feet some of the day',
  moderately_active: 'Active job or lots of walking',
  very_active: 'Physical work or a very active job',
  extra_active: 'Hard physical work all day',
}

const GOAL_HINTS: Record<FitnessGoal, string> = {
  aggressive_cut: 'Eat 750 kcal a day less than you burn',
  moderate_cut: 'Eat 500 kcal a day less',
  mild_cut: 'Eat 250 kcal a day less',
  maintenance: 'Eat what you burn',
  lean_bulk: 'Eat 250 kcal a day more',
  moderate_bulk: 'Eat 500 kcal a day more',
}

const ACTIVITY_OPTIONS = (Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(value => ({
  value, label: sentence(ACTIVITY_LABELS[value]), hint: ACTIVITY_HINTS[value],
}))
const GOAL_OPTIONS = (Object.keys(GOAL_LABELS) as FitnessGoal[]).map(value => ({
  value, label: sentence(GOAL_LABELS[value]), hint: GOAL_HINTS[value],
}))

type Key = 'weight' | 'height' | 'age'
const FIELDS: Record<Key, { label: string; unit: string; rule: NumberRule }> = {
  weight: { label: 'Weight', unit: 'kg', rule: { min: 20, max: 300, decimal: true } },
  height: { label: 'Height', unit: 'cm', rule: { min: 100, max: 250, decimal: true } },
  age: { label: 'Age', unit: 'yrs', rule: { min: 10, max: 120, integer: true } },
}

interface Values {
  sex: Sex
  weight: string
  height: string
  age: string
  activity: ActivityLevel
  goal: FitnessGoal
  diet: string[]
}

const str = (n: number | null | undefined) => (n == null ? '' : String(n))

function fromUser(u: User): Values {
  const p = u.personal
  return {
    sex: (p?.sex as Sex) || 'male',
    weight: str(p?.weight_kg),
    height: str(p?.height_cm),
    age: str(p?.age),
    activity: (p?.activity_level as ActivityLevel) || 'moderately_active',
    goal: (p?.fitness_goal as FitnessGoal) || 'maintenance',
    diet: u.dietary_restrictions ?? [],
  }
}

const same = (a: Values, b: Values) =>
  a.sex === b.sex && a.weight === b.weight && a.height === b.height && a.age === b.age &&
  a.activity === b.activity && a.goal === b.goal && [...a.diet].sort().join() === [...b.diet].sort().join()

export default function PersonalPage() {
  const { user, updatePersonal } = useUser()
  const saved = useMemo(() => (user ? fromUser(user) : null), [user])
  const [vals, setVals] = useState<Values | null>(saved)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => { if (saved) setVals(saved) }, [saved])

  if (!vals || !saved) return null

  const set = (patch: Partial<Values>) => setVals(v => (v ? { ...v, ...patch } : v))
  const errors = {
    weight: checkNumber(vals.weight, FIELDS.weight.rule),
    height: checkNumber(vals.height, FIELDS.height.rule),
    age: checkNumber(vals.age, FIELDS.age.rule),
  }
  const invalid = Object.values(errors).some(Boolean)
  const dirty = !same(vals, saved)
  // "~7,000 baseline steps/day" → "7,000"
  const baseline = ACTIVITY_BASELINE_LABELS[vals.activity].match(/[\d,]+/)?.[0]

  function toggleDiet(value: string) {
    set({ diet: vals!.diet.includes(value) ? vals!.diet.filter(r => r !== value) : [...vals!.diet, value] })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!vals || invalid || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await updatePersonal({
        sex: vals.sex,
        weight_kg: parseNumber(vals.weight, true),
        height_cm: parseNumber(vals.height, true),
        age: parseInt(vals.age, 10),
        activity_level: vals.activity,
        fitness_goal: vals.goal,
        dietary_restrictions: vals.diet,
      })
      toast('Details saved', { type: 'success' })
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save your details. Try again."))
    } finally {
      setSaving(false)
    }
  }

  const field = (k: Key) => (
    <NumberField
      id={`personal-${k}`}
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
      <PageHeader title="Personal details" back={{ href: '/profile', label: 'Settings' }} />

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FormCard title="Body">
          <div>
            <p className="label-caps" aria-hidden="true">Sex</p>
            <Segmented label="Sex" options={SEX_OPTIONS} value={vals.sex} onChange={sex => set({ sex })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {field('weight')}
            {field('height')}
            {field('age')}
          </div>
        </FormCard>

        <FormCard title="Activity level">
          <div>
            <ChoiceList label="Activity level" options={ACTIVITY_OPTIONS} value={vals.activity} onChange={activity => set({ activity })} />
            {baseline && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Steps past about {baseline} a day add to your kcal for the day.
              </p>
            )}
          </div>
        </FormCard>

        <FormCard title="Goal">
          <ChoiceList label="Goal" options={GOAL_OPTIONS} value={vals.goal} onChange={goal => set({ goal })} />
        </FormCard>

        <FormCard title="Dietary needs" id="diet">
          <p style={{ margin: '-6px 0 0', fontSize: 13, color: 'var(--muted)' }}>Choose any that apply.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DIETARY_RESTRICTIONS.map(r => {
              const on = vals.diet.includes(r.value)
              return (
                <button
                  key={r.value}
                  type="button"
                  className="btn-pill"
                  data-active={on ? 'true' : undefined}
                  aria-pressed={on}
                  onClick={() => toggleDiet(r.value)}
                  style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {on && <CheckIcon size={16} />}
                  {r.label}
                </button>
              )
            })}
          </div>
        </FormCard>

        <SaveBar dirty={dirty} invalid={invalid} saving={saving} label="Save details" error={saveError} />
      </form>
    </div>
  )
}
