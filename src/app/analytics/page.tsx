'use client'

import { useEffect, useState } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { getAnalytics, getRunningAnalytics, getAnalyticsInsights, getSteps } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import type { AnalyticsResponse, AnalyticsDayData } from '@/types/api'
import type { RunningAnalyticsResponse } from '@/types/running'
import type { StepLog } from '@/types/workouts'

const ACTIVITY_BASELINE_STEPS: Record<string, number> = {
  sedentary: 4000,
  lightly_active: 6000,
  moderately_active: 8000,
  very_active: 10000,
  extra_active: 12000,
}

type Period = 7 | 30

function shortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yday'
  return d.toLocaleDateString('en-GB', { weekday: 'short' })
}

interface BarChartProps {
  days: AnalyticsDayData[]
  getValue: (d: AnalyticsDayData) => number
  goal: number
  color: string
  unit: string
  period: Period
}

function BarChart({ days, getValue, goal, color, unit, period }: BarChartProps) {
  const [mounted, setMounted] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => { setMounted(true) }, [])

  const max = Math.max(goal, ...days.map(getValue))
  const labelEvery = period === 30 ? 5 : 1

  return (
    <div>
      {selected !== null && days[selected] && (
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: '8px',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500,
            color, padding: '4px 10px',
            borderRadius: '8px', backgroundColor: 'var(--tg-theme-bg-color)',
          }}>
            {period === 7 ? dayLabel(days[selected].date) : shortDate(days[selected].date)}: {Math.round(getValue(days[selected]) * 10) / 10}{unit}
          </span>
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: period === 30 ? '3px' : '5px',
        height: '72px',
      }}>
        {days.map((d, i) => {
          const val = getValue(d)
          const heightPct = max > 0 ? val / max : 0
          const atGoal = val >= goal * 0.9
          const isSelected = selected === i
          return (
            <div
              key={d.date}
              onClick={() => setSelected(prev => prev === i ? null : i)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                height: '100%',
                justifyContent: 'flex-end',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '100%',
                  borderRadius: '4px 4px 2px 2px',
                  backgroundColor: color,
                  opacity: isSelected ? 1 : (atGoal ? 1 : 0.4),
                  height: mounted ? `${Math.max(heightPct * 100, val > 0 ? 4 : 0)}%` : '0%',
                  transition: 'height 0.5s var(--ease-smooth), opacity 0.3s ease',
                  transitionDelay: `${i * 40}ms`,
                  minHeight: val > 0 ? '3px' : '0',
                  boxShadow: isSelected ? `0 0 0 2px ${color}` : 'none',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div style={{
        display: 'flex',
        gap: period === 30 ? '3px' : '5px',
        marginTop: '6px',
      }}>
        {days.map((d, i) => (
          <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
            {(period === 7 || i % labelEvery === 0) && (
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: period === 30 ? '8px' : '9px',
                color: selected === i ? color : 'var(--tg-theme-hint-color)',
                fontWeight: selected === i ? 600 : 400,
                display: 'block',
              }}>
                {period === 7 ? dayLabel(d.date) : shortDate(d.date)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface StatRowProps {
  label: string
  value: string
  sub?: string
  color?: string
}

function StatRow({ label, value, sub, color }: StatRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, color: color ?? 'var(--tg-theme-text-color)' }}>
        {value}
        {sub && <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginLeft: '3px' }}>{sub}</span>}
      </span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p style={{
      fontFamily: 'var(--font-display)',
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--tg-theme-hint-color)',
      marginBottom: '-10px',
    }}>
      {title}
    </p>
  )
}

type Domain = 'food' | 'exercise' | 'steps'

export default function AnalyticsPage() {
  const { user } = useUser()
  const [period, setPeriod] = useState<Period>(7)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [domain, setDomain] = useState<Domain>('food')
  const [runningData, setRunningData] = useState<RunningAnalyticsResponse | null>(null)
  const [runningLoading, setRunningLoading] = useState(false)
  const [stepsData, setStepsData] = useState<StepLog[]>([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const stepGoal = user?.goals.daily_step_goal ?? 10000

  useEffect(() => {
    setLoading(true)
    getAnalytics(period)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    if (domain === 'exercise') {
      setRunningLoading(true)
      getRunningAnalytics(period)
        .then(setRunningData)
        .catch(console.error)
        .finally(() => setRunningLoading(false))
    }
  }, [domain, period])

  useEffect(() => {
    if (domain === 'steps') {
      setStepsLoading(true)
      getSteps(period)
        .then(setStepsData)
        .catch(console.error)
        .finally(() => setStepsLoading(false))
    }
  }, [domain, period])

  const days = data?.days ?? []
  const goals = data?.goals

  // Summary stats
  const activeDays = days.filter(d => d.meals_logged > 0)
  const avgCalories = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.calories, 0) / activeDays.length)
    : 0
  const avgProtein = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.protein, 0) / activeDays.length * 10) / 10
    : 0
  const avgWater = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.water, 0) / activeDays.length * 100) / 100
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

  const [insight, setInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

  useEffect(() => {
    setInsight(null)
    setInsightError(null)
  }, [period])

  function handleGetInsights() {
    setInsightLoading(true)
    setInsightError(null)
    getAnalyticsInsights(period)
      .then(data => setInsight(data.insight))
      .catch(err => setInsightError(err instanceof Error ? err.message : 'Failed to generate insights'))
      .finally(() => setInsightLoading(false))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)',
            marginBottom: '5px',
          }}>
            Progress
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: 'var(--tg-theme-text-color)',
          }}>
            Trends
          </h1>
        </div>

        {/* Period toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '99px',
          padding: '3px',
          gap: '2px',
        }}>
          {([7, 30] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px',
                borderRadius: '99px',
                border: 'none',
                backgroundColor: period === p ? 'var(--tg-theme-button-color)' : 'transparent',
                color: period === p ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-hint-color)',
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              {p === 7 ? '7d' : '30d'}
            </button>
          ))}
        </div>
      </div>

      {/* Domain toggle */}
      <div style={{
        display: 'flex',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        borderRadius: '12px',
        padding: '3px',
        gap: '2px',
      }}>
        {(['food', 'exercise', 'steps'] as Domain[]).map(d => (
          <button
            key={d}
            onClick={() => setDomain(d)}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: domain === d ? 'var(--tg-theme-button-color)' : 'transparent',
              color: domain === d ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-hint-color)',
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease, color 0.2s ease',
            }}
          >
            {d === 'food' ? 'Food' : d === 'exercise' ? 'Exercise' : 'Steps'}
          </button>
        ))}
      </div>

      {domain === 'food' && loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)' }}>
            Loading…
          </p>
        </div>
      ) : (
        <>
          {domain === 'food' && !loading && (<>
          <SectionHeader title="Overview" />
          {/* Summary stats */}
          <div className="fade-up fade-up-1">
            <SummaryCard title={`${period}-day average`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <StatRow label="Calories" value={avgCalories.toString()} sub="kcal" color="var(--accent-calories)" />
                <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                <StatRow label="Protein" value={`${avgProtein}`} sub="g" color="var(--accent-protein)" />
                <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                <StatRow label="Water" value={`${avgWater}`} sub="L" color="var(--accent-water)" />
                <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                <StatRow label="Fiber" value={`${avgFiber}`} sub="g" color="var(--accent-water)" />
                {goals && activeDays.length > 0 && (
                  <>
                    <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{
                        flex: 1, padding: '12px', borderRadius: '12px',
                        backgroundColor: 'var(--tg-theme-bg-color)',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 500, color: 'var(--accent-calories)', margin: 0 }}>
                          {calorieGoalDays}
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', marginLeft: '2px' }}>d</span>
                        </p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>
                          Calorie goal
                        </p>
                      </div>
                      <div style={{
                        flex: 1, padding: '12px', borderRadius: '12px',
                        backgroundColor: 'var(--tg-theme-bg-color)',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 500, color: 'var(--accent-protein)', margin: 0 }}>
                          {proteinGoalDays}
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', marginLeft: '2px' }}>d</span>
                        </p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>
                          Protein goal
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </SummaryCard>
          </div>

          {/* Macro split */}
          {days.length > 0 && activeDays.length > 0 && (
            <div className="fade-up fade-up-2">
              <SummaryCard title="Macro split (avg)">
                {(() => {
                  const avgCarbs = Math.round(activeDays.reduce((s, d) => s + d.carbohydrates, 0) / activeDays.length)
                  const avgFatsVal = Math.round(activeDays.reduce((s, d) => s + d.fats, 0) / activeDays.length)
                  const totalCals = avgCalories || 1
                  const pP = Math.round((avgProtein * 4 / totalCals) * 100)
                  const pC = Math.round((avgCarbs * 4 / totalCals) * 100)
                  const pF = Math.round((avgFatsVal * 9 / totalCals) * 100)
                  const segments = [
                    { label: 'P', pct: pP, color: 'var(--accent-protein)' },
                    { label: 'C', pct: pC, color: 'var(--accent-calories)' },
                    { label: 'F', pct: pF, color: 'var(--accent-fats)' },
                  ]
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', gap: '2px' }}>
                        {segments.map(s => (
                          <div key={s.label} style={{
                            flex: s.pct,
                            backgroundColor: s.color,
                            borderRadius: '99px',
                            transition: 'flex 0.5s var(--ease-smooth)',
                          }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {[
                          { label: 'Protein', val: `${avgProtein}g`, pct: pP, color: 'var(--accent-protein)' },
                          { label: 'Carbs', val: `${avgCarbs}g`, pct: pC, color: 'var(--accent-calories)' },
                          { label: 'Fats', val: `${avgFatsVal}g`, pct: pF, color: 'var(--accent-fats)' },
                        ].map(m => (
                          <div key={m.label} style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: m.color }} />
                              <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>{m.val}</span>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', marginLeft: '3px' }}>{m.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </SummaryCard>
            </div>
          )}

          <SectionHeader title="AI Coach" />
          <div className="fade-up fade-up-2">
            <SummaryCard title="Nutrition Insights">
              {insight ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'var(--tg-theme-text-color)',
                  }}>
                    {insight}
                  </p>
                  <button
                    onClick={handleGetInsights}
                    disabled={insightLoading}
                    style={{
                      alignSelf: 'center',
                      background: 'none',
                      border: '1px solid var(--surface-border)',
                      padding: '8px 18px',
                      borderRadius: '99px',
                      fontFamily: 'var(--font-display)',
                      fontSize: '11px',
                      color: 'var(--tg-theme-hint-color)',
                      cursor: 'pointer',
                    }}
                  >
                    Regenerate
                  </button>
                </div>
              ) : insightLoading ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <div style={{
                    width: '20px', height: '20px', margin: '0 auto 10px',
                    border: '2px solid var(--surface-border)',
                    borderTopColor: 'var(--accent)',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '12px',
                    color: 'var(--tg-theme-hint-color)',
                  }}>
                    Analyzing your {period}-day data...
                  </p>
                </div>
              ) : insightError ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '12px',
                    color: 'var(--accent-calories)', marginBottom: '10px',
                  }}>
                    {insightError}
                  </p>
                  <button
                    onClick={handleGetInsights}
                    style={{
                      background: 'none',
                      border: '1px solid var(--surface-border)',
                      padding: '8px 18px',
                      borderRadius: '99px',
                      fontFamily: 'var(--font-display)',
                      fontSize: '11px',
                      color: 'var(--tg-theme-hint-color)',
                      cursor: 'pointer',
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '12px',
                    color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
                  }}>
                    Get AI-powered feedback on your {period}-day nutrition patterns
                  </p>
                  <button
                    onClick={handleGetInsights}
                    className="btn-primary"
                    style={{
                      width: 'auto',
                      padding: '10px 24px',
                      borderRadius: '99px',
                      fontSize: '12px',
                    }}
                  >
                    Get Insights
                  </button>
                </div>
              )}
            </SummaryCard>
          </div>

          <SectionHeader title="Daily Trends" />
          {/* Calories chart */}
          <div className="fade-up fade-up-3">
            <SummaryCard title="Calories">
              {days.length > 0 && goals ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Goal line label */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '10px',
                      color: 'var(--tg-theme-hint-color)',
                      letterSpacing: '0.06em',
                    }}>
                      Goal: {goals.calories} kcal
                    </span>
                  </div>
                  <BarChart
                    key={period}
                    days={days}
                    getValue={d => d.calories}
                    goal={goals.calories}
                    color="var(--accent-calories)"
                    unit="kcal"
                    period={period}
                  />
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                  No data yet
                </p>
              )}
            </SummaryCard>
          </div>

          {/* Protein chart */}
          <div className="fade-up fade-up-4">
            <SummaryCard title="Protein">
              {days.length > 0 && goals ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', letterSpacing: '0.06em' }}>
                      Goal: {goals.protein}g
                    </span>
                  </div>
                  <BarChart
                    key={period}
                    days={days}
                    getValue={d => d.protein}
                    goal={goals.protein}
                    color="var(--accent-protein)"
                    unit="g"
                    period={period}
                  />
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                  No data yet
                </p>
              )}
            </SummaryCard>
          </div>

          {/* Water chart */}
          <div className="fade-up fade-up-4">
            <SummaryCard title="Hydration">
              {days.length > 0 && goals ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', letterSpacing: '0.06em' }}>
                      Goal: {goals.water}L
                    </span>
                  </div>
                  <BarChart
                    key={period}
                    days={days}
                    getValue={d => d.water}
                    goal={goals.water}
                    color="var(--accent-water)"
                    unit="L"
                    period={period}
                  />
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                  No data yet
                </p>
              )}
            </SummaryCard>
          </div>

          {/* Fiber chart */}
          <div className="fade-up fade-up-4">
            <SummaryCard title="Fiber">
              {days.length > 0 && goals ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', letterSpacing: '0.06em' }}>
                      Goal: {goals.fiber}g
                    </span>
                  </div>
                  <BarChart
                    key={period}
                    days={days}
                    getValue={d => d.fiber}
                    goal={goals.fiber}
                    color="var(--accent-water)"
                    unit="g"
                    period={period}
                  />
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                  No data yet
                </p>
              )}
            </SummaryCard>
          </div>

          </>)}

          {domain === 'exercise' && runningLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)' }}>
                Loading…
              </p>
            </div>
          )}

          {domain === 'exercise' && !runningLoading && runningData && (
            <>
              {/* Running summary */}
              <div className="fade-up fade-up-1">
                <SummaryCard title={`${period}-day summary`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <StatRow label="Total Distance" value={`${(runningData.totals.distance / 1000).toFixed(1)}`} sub="km" color="var(--accent-calories)" />
                    <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                    <StatRow label="Total Runs" value={`${runningData.totals.run_count}`} color="var(--accent-protein)" />
                    <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                    <StatRow label="Calories Burned" value={`${runningData.totals.calories}`} sub="kcal" color="var(--accent-calories)" />
                  </div>
                </SummaryCard>
              </div>

              {/* Distance chart */}
              <div className="fade-up fade-up-2">
                <SummaryCard title="Distance">
                  {runningData.days.length > 0 ? (
                    <BarChart
                      key={`run-dist-${period}`}
                      days={runningData.days.map(d => ({
                        date: d.date,
                        calories: d.total_distance / 1000,
                        protein: 0, carbohydrates: 0, fats: 0, fiber: 0, water: 0, meals_logged: 0,
                      }))}
                      getValue={d => d.calories}
                      goal={5}
                      color="var(--accent-protein)"
                      unit="km"
                      period={period}
                    />
                  ) : (
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                      No data yet
                    </p>
                  )}
                </SummaryCard>
              </div>

              {/* Calories burned chart */}
              <div className="fade-up fade-up-3">
                <SummaryCard title="Calories Burned">
                  {runningData.days.length > 0 ? (
                    <BarChart
                      key={`run-cal-${period}`}
                      days={runningData.days.map(d => ({
                        date: d.date,
                        calories: d.total_calories,
                        protein: 0, carbohydrates: 0, fats: 0, fiber: 0, water: 0, meals_logged: 0,
                      }))}
                      getValue={d => d.calories}
                      goal={500}
                      color="var(--accent-calories)"
                      unit="kcal"
                      period={period}
                    />
                  ) : (
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                      No data yet
                    </p>
                  )}
                </SummaryCard>
              </div>

              {/* Frequency chart */}
              <div className="fade-up fade-up-4">
                <SummaryCard title="Frequency">
                  {runningData.days.length > 0 ? (
                    <BarChart
                      key={`run-freq-${period}`}
                      days={runningData.days.map(d => ({
                        date: d.date,
                        calories: d.run_count,
                        protein: 0, carbohydrates: 0, fats: 0, fiber: 0, water: 0, meals_logged: 0,
                      }))}
                      getValue={d => d.calories}
                      goal={1}
                      color="var(--accent-water)"
                      unit="runs"
                      period={period}
                    />
                  ) : (
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                      No data yet
                    </p>
                  )}
                </SummaryCard>
              </div>
            </>
          )}

          {domain === 'steps' && stepsLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)' }}>Loading…</p>
            </div>
          )}

          {domain === 'steps' && !stepsLoading && (
            <>
              {/* Streaks & Consistency */}
              <div className="fade-up fade-up-1">
                <SummaryCard title="Streaks & Consistency">
                  {(() => {
                    // Sort by date descending for streak calculation
                    const sorted = [...stepsData].sort((a, b) => b.date.localeCompare(a.date))
                    let currentStreak = 0
                    for (const d of sorted) {
                      if (d.steps >= stepGoal) currentStreak++
                      else break
                    }
                    // Longest streak
                    const chronological = [...stepsData].sort((a, b) => a.date.localeCompare(b.date))
                    let longestStreak = 0
                    let tempStreak = 0
                    for (const d of chronological) {
                      if (d.steps >= stepGoal) {
                        tempStreak++
                        if (tempStreak > longestStreak) longestStreak = tempStreak
                      } else {
                        tempStreak = 0
                      }
                    }
                    const goalHitDays = stepsData.filter(d => d.steps >= stepGoal).length
                    // Last 14 days dots
                    const last14 = chronological.slice(-14)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <StatRow label="Current Streak" value={`${currentStreak}`} sub="days" color="var(--accent-steps)" />
                        <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                        <StatRow label="Longest Streak" value={`${longestStreak}`} sub="days" color="var(--accent-steps)" />
                        <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                        <StatRow label="Goal Hit Rate" value={`${goalHitDays}/${stepsData.length}`} sub="days" />
                        <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                        {/* Dot visualization — last 14 days */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {last14.map((d) => (
                            <div
                              key={d.date}
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: d.steps >= stepGoal ? 'var(--accent-steps)' : 'transparent',
                                border: d.steps >= stepGoal ? 'none' : '1.5px solid var(--tg-theme-hint-color)',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </SummaryCard>
              </div>

              {/* Stats card */}
              <div className="fade-up fade-up-2">
                <SummaryCard title={`${period}-day steps`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <StatRow label="Average" value={`${stepsData.length > 0 ? Math.round(stepsData.reduce((s, d) => s + d.steps, 0) / stepsData.length).toLocaleString() : '0'}`} sub="steps/day" />
                    <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                    <StatRow label="Total" value={`${stepsData.reduce((s, d) => s + d.steps, 0).toLocaleString()}`} sub="steps" />
                    <div style={{ height: '1px', backgroundColor: 'var(--surface-border)' }} />
                    <StatRow
                      label="Extra Calories Earned"
                      value={`${(() => {
                        const activityLevel = user?.personal?.activity_level ?? 'moderately_active'
                        const baseline = ACTIVITY_BASELINE_STEPS[activityLevel] ?? 8000
                        const weight = user?.personal?.weight_kg ?? 70
                        const total = stepsData.reduce((sum, d) => sum + Math.max(0, d.steps - baseline) * 0.04 * weight, 0)
                        return Math.round(total).toLocaleString()
                      })()}`}
                      sub="kcal"
                      color="var(--accent-steps)"
                    />
                  </div>
                </SummaryCard>
              </div>

              {/* Daily Steps Bar Chart */}
              <div className="fade-up fade-up-3">
                <SummaryCard title="Daily Steps">
                  {stepsData.length > 0 ? (
                    <BarChart
                      key={`steps-${period}`}
                      days={stepsData.map(d => ({
                        date: d.date,
                        calories: d.steps,
                        protein: 0, carbohydrates: 0, fats: 0, fiber: 0, water: 0, meals_logged: 0,
                      }))}
                      getValue={d => d.calories}
                      goal={stepGoal}
                      color="var(--accent-steps)"
                      unit=" steps"
                      period={period}
                    />
                  ) : (
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                      No step data yet
                    </p>
                  )}
                </SummaryCard>
              </div>

              {/* Day-of-Week Pattern */}
              <div className="fade-up fade-up-4">
                <SummaryCard title="Day-of-Week Pattern">
                  {stepsData.length >= 7 ? (
                    (() => {
                      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      const daySums: number[] = [0, 0, 0, 0, 0, 0, 0]
                      const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0]
                      stepsData.forEach(d => {
                        const dow = new Date(d.date + 'T00:00:00').getDay()
                        daySums[dow] += d.steps
                        dayCounts[dow]++
                      })
                      const dayAvgs = daySums.map((sum, i) => dayCounts[i] > 0 ? Math.round(sum / dayCounts[i]) : 0)
                      const maxAvg = Math.max(...dayAvgs, 1)
                      return (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
                          {dayAvgs.map((avg, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                              <div
                                style={{
                                  width: '100%',
                                  borderRadius: '4px 4px 2px 2px',
                                  backgroundColor: 'var(--accent-steps)',
                                  opacity: avg >= stepGoal ? 1 : 0.5,
                                  height: `${Math.max((avg / maxAvg) * 100, avg > 0 ? 4 : 0)}%`,
                                  minHeight: avg > 0 ? '3px' : '0',
                                  transition: 'height 0.5s var(--ease-out-expo)',
                                }}
                              />
                              <span style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '10px',
                                color: 'var(--tg-theme-hint-color)',
                                marginTop: '4px',
                              }}>
                                {dayNames[i]}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })()
                  ) : (
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
                      Need at least 7 days of data
                    </p>
                  )}
                </SummaryCard>
              </div>
            </>
          )}
        </>
      )}

    </div>
  )
}
