'use client'

import { useState } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import type { StepLog } from '@/types/workouts'
import type { User } from '@/types/api'
import { calculateStepAllowance } from '@/lib/steps'
import { currentStepStreak, longestStepStreak } from '@/lib/streak'
import { dayKey } from '@/lib/day'
import BarChart from './BarChart'
import { Chips, EmptyCard, HeadlineCard, Note, StatList } from './parts'
import { axisLabel, dayName, deltaText, goalText, num, periodKeys, weekdayOf, type Period } from './trends'

const stepsFmt = (n: number) => `${num(n)} steps`

function avgStepsOf(logs: StepLog[]): number | null {
  return logs.length > 0 ? Math.round(logs.reduce((s, d) => s + d.steps, 0) / logs.length) : null
}

// Monday first; values index into `Date#getUTCDay` (0 = Sunday).
const WEEK = [
  { dow: 1, short: 'Mon', name: 'Mondays' }, { dow: 2, short: 'Tue', name: 'Tuesdays' },
  { dow: 3, short: 'Wed', name: 'Wednesdays' }, { dow: 4, short: 'Thu', name: 'Thursdays' },
  { dow: 5, short: 'Fri', name: 'Fridays' }, { dow: 6, short: 'Sat', name: 'Saturdays' },
  { dow: 0, short: 'Sun', name: 'Sundays' },
]

export default function StepsView({ stepsData, prevSteps, stepGoal, user, period }: {
  stepsData: StepLog[]
  prevSteps: StepLog[]
  stepGoal: number
  user: User | null
  period: Period
}) {
  const [view, setView] = useState<'day' | 'weekday'>('day')
  const avg = avgStepsOf(stepsData)
  if (avg === null) return <EmptyCard period={period} goal={stepGoal} />

  const currentStreak = currentStepStreak(stepsData, stepGoal)
  const longestStreak = longestStepStreak(stepsData, stepGoal)
  const goalHitDays = stepsData.filter(d => d.steps >= stepGoal).length
  const total = stepsData.reduce((s, d) => s + d.steps, 0)
  const extraKcal = (() => {
    const activityLevel = user?.personal?.activity_level ?? 'moderately_active'
    const weight = user?.personal?.weight_kg ?? null
    // Same per-day allowance the dashboard/API credits (src/lib/steps.ts)
    const sum = stepsData.reduce(
      (acc, d) => acc + calculateStepAllowance(d.steps, activityLevel, weight),
      0,
    )
    // Per-day allowances are fractional; without the round this renders as
    // "1,234.5678901".
    return Math.round(sum)
  })()

  // Day-of-week pattern (same averaging as before the redesign)
  const daySums: number[] = [0, 0, 0, 0, 0, 0, 0]
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0]
  stepsData.forEach(d => {
    const dow = weekdayOf(d.date)
    if (dow === null) return
    daySums[dow] += d.steps
    dayCounts[dow]++
  })
  const dayAvgs = daySums.map((sum, i) => dayCounts[i] > 0 ? Math.round(sum / dayCounts[i]) : 0)

  // The chart shows every day of the period, so a day with no sync reads as a gap.
  const today = dayKey()
  const byDate = new Map(stepsData.map(d => [d.date, d.steps]))
  const keys = periodKeys(period, today)

  return (
    <>
      <HeadlineCard
        title="Daily average"
        value={num(avg)}
        unit="steps"
        delta={deltaText(avg, avgStepsOf(prevSteps), stepsFmt, period)}
        goal={goalText(avg, stepGoal, false, stepsFmt)}
        note={`Steps synced on ${stepsData.length} of ${period} days`}
      />

      <SummaryCard>
        <Chips
          label="Chart"
          options={[{ value: 'day', label: 'By day' }, { value: 'weekday', label: 'By weekday' }]}
          value={view}
          onChange={setView}
        />
        {view === 'day' ? (
          <BarChart
            key={period}
            label="Steps by day"
            tint="var(--m-steps)"
            format={stepsFmt}
            goal={stepGoal}
            goalLabel={`Goal ${num(stepGoal)}`}
            bars={keys.map(k => ({
              key: k, axis: axisLabel(k, keys.length, today), name: dayName(k),
              value: byDate.get(k) ?? 0, today: k === today,
            }))}
          />
        ) : stepsData.length >= 7 ? (
          <BarChart
            label="Average steps by weekday"
            tint="var(--m-steps)"
            format={v => `${stepsFmt(v)} on average`}
            goal={stepGoal}
            goalLabel={`Goal ${num(stepGoal)}`}
            hint="Tap a day to see its average"
            bars={WEEK.map(w => ({ key: w.short, axis: w.short, name: w.name, value: dayAvgs[w.dow] }))}
          />
        ) : (
          <Note>Log at least 7 days of steps to see which days you move most.</Note>
        )}
      </SummaryCard>

      <StatList
        title="Streaks and totals"
        rows={[
          { label: 'Current streak', value: num(currentStreak), sub: currentStreak === 1 ? 'day' : 'days' },
          { label: 'Longest streak', value: num(longestStreak), sub: longestStreak === 1 ? 'day' : 'days' },
          { label: 'Days on goal', value: `${goalHitDays} of ${stepsData.length}`, sub: 'days' },
          { label: 'Total', value: num(total), sub: 'steps' },
          { label: 'Extra food from steps', value: `${num(extraKcal)} kcal` },
        ]}
      />
    </>
  )
}
