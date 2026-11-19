'use client'

import { useState } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import type { AnalyticsDayData, AnalyticsResponse } from '@/types/api'
import { dayKey } from '@/lib/day'
import BarChart from './BarChart'
import { Chips, EmptyCard, HeadlineCard, StatList } from './parts'
import { axisLabel, dayName, deltaText, goalText, num, type Period } from './trends'

type Goals = AnalyticsResponse['goals']
type MetricKey = 'calories' | 'protein' | 'carbs' | 'fats' | 'fibre'

const METRICS: {
  value: MetricKey; label: string; unit: string; tint: string; overIsBad: boolean; frac: number
  get: (d: AnalyticsDayData) => number; goal: (g: Goals) => number
}[] = [
  { value: 'calories', label: 'Calories', unit: 'kcal', tint: 'var(--m-calories)', overIsBad: true, frac: 0, get: d => d.calories, goal: g => g.calories },
  { value: 'protein', label: 'Protein', unit: 'g', tint: 'var(--m-protein)', overIsBad: false, frac: 1, get: d => d.protein, goal: g => g.protein },
  { value: 'carbs', label: 'Carbs', unit: 'g', tint: 'var(--m-carbs)', overIsBad: true, frac: 1, get: d => d.carbohydrates, goal: g => g.carbohydrates },
  { value: 'fats', label: 'Fats', unit: 'g', tint: 'var(--m-fats)', overIsBad: true, frac: 1, get: d => d.fats, goal: g => g.fats },
  { value: 'fibre', label: 'Fibre', unit: 'g', tint: 'var(--m-fibre)', overIsBad: false, frac: 1, get: d => d.fiber, goal: g => g.fiber },
]

const kcal = (n: number) => `${num(n)} kcal`

function avgCaloriesOf(days: AnalyticsDayData[]): number | null {
  const active = days.filter(d => d.meals_logged > 0)
  return active.length > 0 ? Math.round(active.reduce((s, d) => s + d.calories, 0) / active.length) : null
}

export default function FoodView({ days, prevDays, goals, period }: {
  days: AnalyticsDayData[]
  prevDays: AnalyticsDayData[]
  goals: Goals | undefined
  period: Period
}) {
  const [metric, setMetric] = useState<MetricKey>('calories')

  // Summary stats (same formulas as before the redesign)
  const activeDays = days.filter(d => d.meals_logged > 0)
  const avgCalories = avgCaloriesOf(days) ?? 0
  const avgProtein = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.protein, 0) / activeDays.length * 10) / 10
    : 0
  const avgFiber = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.fiber, 0) / activeDays.length * 10) / 10
    : 0
  const calorieGoalDays = goals
    ? days.filter(d => d.meals_logged > 0 && d.calories >= goals.calories * 0.9 && d.calories <= goals.calories * 1.1).length
    : 0
  const proteinGoalDays = goals
    ? days.filter(d => d.meals_logged > 0 && d.protein >= goals.protein * 0.9).length
    : 0

  if (activeDays.length === 0) return <EmptyCard period={period} goal={goals?.calories} />

  const avgCarbs = Math.round(activeDays.reduce((s, d) => s + d.carbohydrates, 0) / activeDays.length)
  const avgFatsVal = Math.round(activeDays.reduce((s, d) => s + d.fats, 0) / activeDays.length)
  const totalCals = avgCalories || 1
  const pP = Math.round((avgProtein * 4 / totalCals) * 100)
  const pC = Math.round((avgCarbs * 4 / totalCals) * 100)
  const pF = Math.round((avgFatsVal * 9 / totalCals) * 100)

  const m = METRICS.find(x => x.value === metric)!
  const fmt = (v: number) => `${num(v, m.frac)} ${m.unit}`
  const today = dayKey()
  const goal = goals ? m.goal(goals) : undefined

  const split = [
    { label: 'Protein', g: avgProtein, pct: pP, tint: 'var(--m-protein)' },
    { label: 'Carbs', g: avgCarbs, pct: pC, tint: 'var(--m-carbs)' },
    { label: 'Fats', g: avgFatsVal, pct: pF, tint: 'var(--m-fats)' },
  ]

  return (
    <>
      <HeadlineCard
        title="Daily average"
        value={num(avgCalories)}
        unit="kcal"
        delta={deltaText(avgCalories, avgCaloriesOf(prevDays), kcal, period)}
        goal={goals ? goalText(avgCalories, goals.calories, true, kcal) : null}
        note={`Meals logged on ${activeDays.length} of ${days.length} days`}
      />

      <SummaryCard>
        <Chips label="Metric" options={METRICS} value={metric} onChange={setMetric} />
        <BarChart
          key={period}
          label={`${m.label} by day`}
          tint={m.tint}
          overIsBad={m.overIsBad}
          format={fmt}
          goal={goal}
          goalLabel={goal ? `Goal ${fmt(goal)}` : undefined}
          bars={days.map(d => ({
            key: d.date, axis: axisLabel(d.date, days.length, today), name: dayName(d.date),
            value: m.get(d), today: d.date === today,
          }))}
        />
      </SummaryCard>

      <StatList
        title="Macro split"
        rows={[
          ...split.map(s => ({
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: s.tint }} />{s.label}
            </span>,
            value: `${s.g} g`,
            sub: `${s.pct}% of kcal`,
          })),
          { label: 'Fibre', value: `${avgFiber} g` },
        ]}
      >
        <div aria-hidden="true" style={{ display: 'flex', height: 8, gap: 2, marginBottom: 6 }}>
          {split.map(s => (
            <div key={s.label} style={{ flex: s.pct, borderRadius: 4, background: s.tint, transition: 'flex .5s var(--ease-smooth)' }} />
          ))}
        </div>
      </StatList>

      {goals && (
        <StatList
          title="Days on goal"
          rows={[
            { label: 'Calories within 10% of goal', value: `${calorieGoalDays} of ${activeDays.length}`, sub: 'days' },
            { label: 'Protein at least 90% of goal', value: `${proteinGoalDays} of ${activeDays.length}`, sub: 'days' },
          ]}
        />
      )}
    </>
  )
}
