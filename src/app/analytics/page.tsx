'use client'

import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react'
import { getAnalytics, getRunningAnalytics, getAnalyticsInsights, getSteps, getWorkouts } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import type { AnalyticsResponse } from '@/types/api'
import type { RunningAnalyticsResponse } from '@/types/running'
import type { StepLog, WorkoutLog } from '@/types/workouts'
import { calculateMuscleIntensities } from '@/lib/muscle-intensity'
import { errorMessage } from '@/lib/errors'
import { dayKey } from '@/lib/day'
import PageHeader from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import FoodView from '@/components/analytics/FoodView'
import WaterView from '@/components/analytics/WaterView'
import StepsView from '@/components/analytics/StepsView'
import TrainingView from '@/components/analytics/TrainingView'
import { ErrorCard, ReadCard, TrendsSkeleton } from '@/components/analytics/parts'
import { splitWindow, type Period } from '@/components/analytics/trends'

type Domain = 'food' | 'water' | 'training' | 'steps'

const DOMAINS: { value: Domain; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'water', label: 'Water' },
  { value: 'training', label: 'Training' },
  { value: 'steps', label: 'Steps' },
]
const PERIODS: { value: '7' | '30'; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
]

// The page only renders after AuthGate has a user, i.e. client-side, so the
// stored choice can seed state directly without a hydration mismatch.
function readPref(key: string, allowed: string[], fallback: string): string {
  try {
    const v = window.localStorage.getItem(key)
    return v !== null && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function writePref(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* private mode: the choice just isn't remembered */ }
}

export default function AnalyticsPage() {
  const { user } = useUser()
  const [period, setPeriodState] = useState<Period>(() => (readPref('trends.period', ['7', '30'], '7') === '30' ? 30 : 7))
  const [domain, setDomainState] = useState<Domain>(() => readPref('trends.domain', DOMAINS.map(d => d.value), 'food') as Domain)
  const setPeriod = (p: Period) => { setPeriodState(p); writePref('trends.period', String(p)) }
  const setDomain = (d: Domain) => { setDomainState(d); writePref('trends.domain', d) }

  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningData, setRunningData] = useState<RunningAnalyticsResponse | null>(null)
  const [runningLoading, setRunningLoading] = useState(false)
  // `null` until the first response, so the first frame shows the skeleton.
  const [stepsAll, setStepsAll] = useState<StepLog[] | null>(null)
  const [stepsLoading, setStepsLoading] = useState(false)
  const [workoutsAll, setWorkoutsAll] = useState<WorkoutLog[] | null>(null)
  const [workoutLoading, setWorkoutLoading] = useState(false)
  const [failed, setFailed] = useState<{ analytics?: boolean; running?: boolean; steps?: boolean; workouts?: boolean }>({})
  const [reload, setReload] = useState(0)
  const stepGoal = user?.goals.daily_step_goal ?? 10000

  // Switching 7d/30d or tabs quickly can land responses out of order — each
  // fetch keeps a request id and only the newest one is allowed to write.
  const analyticsReqRef = useRef(0)
  const runningReqRef = useRef(0)
  const stepsReqRef = useRef(0)
  const workoutReqRef = useRef(0)

  // Food, water, steps and workouts fetch twice the period: the older half is
  // the "vs last week" comparison, the newer half is exactly what `?days=period`
  // returned before (see `splitWindow`).
  useEffect(() => {
    const requestId = ++analyticsReqRef.current
    setLoading(true)
    setFailed(f => ({ ...f, analytics: false }))
    getAnalytics(period * 2)
      .then(result => { if (analyticsReqRef.current === requestId) setData(result) })
      .catch(err => {
        console.error(err)
        if (analyticsReqRef.current === requestId) setFailed(f => ({ ...f, analytics: true }))
      })
      .finally(() => { if (analyticsReqRef.current === requestId) setLoading(false) })
  }, [period, reload])

  useEffect(() => {
    if (domain === 'training') {
      const requestId = ++runningReqRef.current
      setRunningLoading(true)
      setFailed(f => ({ ...f, running: false }))
      getRunningAnalytics(period)
        .then(result => { if (runningReqRef.current === requestId) setRunningData(result) })
        .catch(err => {
          console.error(err)
          if (runningReqRef.current === requestId) setFailed(f => ({ ...f, running: true }))
        })
        .finally(() => { if (runningReqRef.current === requestId) setRunningLoading(false) })
    }
  }, [domain, period, reload])

  useEffect(() => {
    if (domain === 'steps') {
      const requestId = ++stepsReqRef.current
      setStepsLoading(true)
      setFailed(f => ({ ...f, steps: false }))
      getSteps(period * 2)
        .then(data => {
          if (stepsReqRef.current !== requestId) return
          setStepsAll(data.map(d => ({ ...d, date: d.date.slice(0, 10) })).sort((a, b) => a.date.localeCompare(b.date)))
        })
        .catch(err => {
          console.error(err)
          if (stepsReqRef.current === requestId) setFailed(f => ({ ...f, steps: true }))
        })
        .finally(() => { if (stepsReqRef.current === requestId) setStepsLoading(false) })
    }
  }, [domain, period, reload])

  useEffect(() => {
    if (domain === 'training') {
      const requestId = ++workoutReqRef.current
      setWorkoutLoading(true)
      setFailed(f => ({ ...f, workouts: false }))
      getWorkouts(period * 2)
        .then(result => { if (workoutReqRef.current === requestId) setWorkoutsAll(result) })
        .catch(err => {
          console.error(err)
          if (workoutReqRef.current === requestId) setFailed(f => ({ ...f, workouts: true }))
        })
        .finally(() => { if (workoutReqRef.current === requestId) setWorkoutLoading(false) })
    }
  }, [domain, period, reload])

  const food = useMemo(() => splitWindow(data?.days ?? [], d => d.date, period), [data, period])
  const steps = useMemo(() => splitWindow(stepsAll ?? [], d => d.date, period), [stepsAll, period])
  const workouts = useMemo(
    () => splitWindow(workoutsAll ?? [], w => dayKey(new Date(w.workout_date)), period),
    [workoutsAll, period],
  )
  const workoutData = workouts.current

  // The exercise→muscle table is code-split, so intensities resolve in an
  // effect rather than during render.
  const [workoutIntensities, setWorkoutIntensities] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    if (workoutData.length === 0) {
      setWorkoutIntensities({})
      return
    }
    calculateMuscleIntensities(workoutData.flatMap(w => w.exercises))
      .then(result => { if (!cancelled) setWorkoutIntensities(result) })
      .catch(err => console.error('Failed to compute muscle intensities:', err))
    return () => { cancelled = true }
  }, [workoutData])

  const [insight, setInsight] = useState<string | null>(null)
  const [insightAt, setInsightAt] = useState<Date | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)
  // The API returns `insight: null` when there is nothing logged in the window.
  const [insightEmpty, setInsightEmpty] = useState(false)
  // Same guard as the other fetches: flipping 7d/30d mid-request must not let
  // the older period's insight land on the newer one.
  const insightReqRef = useRef(0)

  useEffect(() => {
    // Bumping the id orphans anything still in flight for the old period.
    insightReqRef.current++
    setInsight(null)
    setInsightError(null)
    setInsightEmpty(false)
    setInsightLoading(false)
  }, [period])

  function handleGetInsights() {
    const requestId = ++insightReqRef.current
    setInsightLoading(true)
    setInsightError(null)
    setInsightEmpty(false)
    getAnalyticsInsights(period)
      .then(data => {
        if (insightReqRef.current !== requestId) return
        const text = data.insight
        setInsight(text ?? null)
        setInsightAt(new Date())
        setInsightEmpty(!text)
      })
      .catch(err => {
        if (insightReqRef.current !== requestId) return
        setInsightError(errorMessage(err, 'Couldn’t write your read just now. Try again in a moment.'))
      })
      .finally(() => { if (insightReqRef.current === requestId) setInsightLoading(false) })
  }

  const retry = () => setReload(r => r + 1)

  let view: ReactNode
  if (domain === 'food' || domain === 'water') {
    if (loading || (!data && !failed.analytics)) view = <TrendsSkeleton />
    else if (failed.analytics) view = <ErrorCard onRetry={retry} />
    else if (domain === 'food') view = <FoodView days={food.current} prevDays={food.previous} goals={data?.goals} period={period} />
    else view = <WaterView days={food.current} prevDays={food.previous} goal={data?.goals.water} period={period} />
  } else if (domain === 'steps') {
    if (stepsLoading || (!stepsAll && !failed.steps)) view = <TrendsSkeleton />
    else if (failed.steps) view = <ErrorCard onRetry={retry} />
    else view = <StepsView stepsData={steps.current} prevSteps={steps.previous} stepGoal={stepGoal} user={user} period={period} />
  } else {
    const failedHere = failed.workouts || failed.running
    if (workoutLoading || runningLoading || (!failedHere && (!workoutsAll || !runningData))) view = <TrendsSkeleton />
    else if (failedHere) view = <ErrorCard onRetry={retry} />
    else view = (
      <TrainingView
        workouts={workoutData}
        prevWorkouts={workouts.previous}
        intensities={workoutIntensities}
        runningData={runningData}
        sex={user?.personal?.sex}
        period={period}
      />
    )
  }

  return (
    <div>
      <PageHeader title="Trends" />

      <div style={{ maxWidth: 220 }}>
        <Segmented
          label="Period"
          options={PERIODS}
          value={String(period) as '7' | '30'}
          onChange={v => setPeriod(v === '30' ? 30 : 7)}
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <Segmented label="Show trends for" options={DOMAINS} value={domain} onChange={setDomain} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {view}
        <ReadCard
          period={period}
          insight={insight}
          loading={insightLoading}
          error={insightError}
          empty={insightEmpty}
          updatedAt={insightAt}
          onGenerate={handleGetInsights}
        />
      </div>
    </div>
  )
}
