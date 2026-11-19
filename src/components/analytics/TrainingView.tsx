'use client'

import { useMemo, useState } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import MuscleMap from '@/components/workouts/MuscleMap'
import VolumeTrendsChart from '@/components/workouts/VolumeTrendsChart'
import PersonalRecords from '@/components/workouts/PersonalRecords'
import TrainingRecap from '@/components/workouts/TrainingRecap'
import MuscleBalance from '@/components/workouts/MuscleBalance'
import type { RunningAnalyticsResponse } from '@/types/running'
import type { WorkoutLog } from '@/types/workouts'
import { dayKey } from '@/lib/day'
import BarChart from './BarChart'
import { Chips, EmptyCard, HeadlineCard, Note, StatList } from './parts'
import { axisLabel, dayName, deltaText, num, type Period } from './trends'

type RunMetric = 'distance' | 'burned' | 'runs'

const km = (n: number) => `${num(n, 1)} km`
const kcal = (n: number) => `${num(n)} kcal`

export default function TrainingView({ workouts, prevWorkouts, intensities, runningData, sex, period }: {
  workouts: WorkoutLog[]
  prevWorkouts: WorkoutLog[] | null
  intensities: Record<string, number>
  runningData: RunningAnalyticsResponse | null
  sex?: string
  period: Period
}) {
  const [runMetric, setRunMetric] = useState<RunMetric>('distance')

  /**
   * The distance and calorie charts have no configurable target, so the
   * reference line is the user's own average on days they actually ran.
   */
  const runDayAverages = useMemo(() => {
    const runDays = runningData?.days.filter(d => d.run_count > 0) ?? []
    if (runDays.length === 0) return { distanceKm: 0, calories: 0 }
    return {
      distanceKm: runDays.reduce((s, d) => s + d.total_distance, 0) / runDays.length / 1000,
      calories: runDays.reduce((s, d) => s + d.total_calories, 0) / runDays.length,
    }
  }, [runningData])

  const activeZoneCount = useMemo(() => {
    return Object.values(intensities).filter((v): v is number => typeof v === 'number' && v >= 0.2).length
  }, [intensities])

  const runCount = runningData?.totals.run_count ?? 0
  if (workouts.length === 0 && runCount === 0) return <EmptyCard period={period} />

  const today = dayKey()
  const runDays = runningData?.days ?? []
  const run = {
    distance: { get: (d: typeof runDays[number]) => d.total_distance / 1000, goal: runDayAverages.distanceKm, fmt: km, tint: 'var(--m-protein)' },
    burned: { get: (d: typeof runDays[number]) => d.total_calories, goal: runDayAverages.calories, fmt: kcal, tint: 'var(--m-calories)' },
    runs: { get: (d: typeof runDays[number]) => d.run_count, goal: undefined, fmt: (n: number) => `${num(n)} ${n === 1 ? 'run' : 'runs'}`, tint: 'var(--m-water)' },
  }[runMetric]

  const count = (n: number) => `${num(n)}`
  const runLine = runningData && runCount > 0
    ? `${runCount} ${runCount === 1 ? 'run' : 'runs'} · ${km(runningData.totals.distance / 1000)}`
    : null

  return (
    <>
      <HeadlineCard
        title="Workouts"
        value={num(workouts.length)}
        unit={workouts.length === 1 ? 'workout' : 'workouts'}
        delta={deltaText(workouts.length, prevWorkouts ? prevWorkouts.length : null, count, period)}
        goal={workouts.length > 0 ? { text: `${activeZoneCount} muscle groups worked`, over: false } : null}
        note={runLine}
      />

      {workouts.length > 0 && (
        <>
          <VolumeTrendsChart workouts={workouts} period={period} />
          <SummaryCard title="Muscles worked">
            <MuscleMap intensities={intensities} size="md" sex={sex} />
          </SummaryCard>
          <MuscleBalance workouts={workouts} />
        </>
      )}
      <PersonalRecords period={period} />
      <TrainingRecap period={period} workoutCount={workouts.length} />

      {runningData && (
        <SummaryCard title={runCount > 0 ? undefined : 'Runs'}>
          {runCount > 0 ? (
            <>
              <Chips
                label="Run metric"
                options={[{ value: 'distance', label: 'Distance' }, { value: 'burned', label: 'Burned' }, { value: 'runs', label: 'Runs' }]}
                value={runMetric}
                onChange={setRunMetric}
              />
              <BarChart
                key={period}
                label={`Runs by day: ${runMetric}`}
                tint={run.tint}
                format={run.fmt}
                goal={run.goal}
                goalLabel={run.goal ? `Run-day average ${run.fmt(run.goal)}` : undefined}
                bars={runDays.map(d => ({
                  key: d.date, axis: axisLabel(d.date, runDays.length, today), name: dayName(d.date),
                  value: run.get(d), today: d.date === today,
                }))}
              />
            </>
          ) : (
            <Note>No runs in the last {period} days.</Note>
          )}
        </SummaryCard>
      )}

      {runningData && runCount > 0 && (
        <StatList
          title="Run totals"
          rows={[
            { label: 'Runs', value: num(runningData.totals.run_count) },
            { label: 'Distance', value: km(runningData.totals.distance / 1000) },
            { label: 'Burned', value: kcal(Math.round(runningData.totals.calories)) },
          ]}
        />
      )}
    </>
  )
}
