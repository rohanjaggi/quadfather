'use client'

import SummaryCard from '@/components/dashboard/SummaryCard'
import type { AnalyticsDayData } from '@/types/api'
import { dayKey } from '@/lib/day'
import BarChart from './BarChart'
import { EmptyCard, HeadlineCard, StatList } from './parts'
import { axisLabel, dayName, deltaText, goalText, num, type Period } from './trends'

const litres = (n: number) => `${num(n, 1)} L`

// Same formula as before the redesign: average over days with any water.
function avgWaterOf(days: AnalyticsDayData[]): number | null {
  const waterDays = days.filter(d => d.water > 0)
  return waterDays.length > 0
    ? Math.round(waterDays.reduce((s, d) => s + d.water, 0) / waterDays.length * 100) / 100
    : null
}

export default function WaterView({ days, prevDays, goal, period }: {
  days: AnalyticsDayData[]
  prevDays: AnalyticsDayData[]
  goal: number | undefined
  period: Period
}) {
  const avgWater = avgWaterOf(days)
  if (avgWater === null) return <EmptyCard period={period} goal={goal} />

  const today = dayKey()
  const waterDays = days.filter(d => d.water > 0)
  const best = waterDays.reduce((a, b) => (b.water > a.water ? b : a))
  const goalDays = goal ? days.filter(d => d.water >= goal).length : null

  return (
    <>
      <HeadlineCard
        title="Daily average"
        value={num(avgWater, 1)}
        unit="L"
        delta={deltaText(avgWater, avgWaterOf(prevDays), litres, period)}
        goal={goal ? goalText(avgWater, goal, false, litres) : null}
        note={`Water logged on ${waterDays.length} of ${days.length} days`}
      />

      <SummaryCard title="Water by day">
        <BarChart
          key={period}
          label="Water by day"
          tint="var(--m-water)"
          format={litres}
          goal={goal}
          goalLabel={goal ? `Goal ${litres(goal)}` : undefined}
          bars={days.map(d => ({
            key: d.date, axis: axisLabel(d.date, days.length, today), name: dayName(d.date),
            value: d.water, today: d.date === today,
          }))}
        />
      </SummaryCard>

      <StatList
        title="This period"
        rows={[
          ...(goalDays !== null ? [{ label: 'Days on goal', value: `${goalDays} of ${days.length}`, sub: 'days' }] : []),
          { label: 'Best day', value: litres(best.water), sub: dayName(best.date) },
          { label: 'Total', value: litres(days.reduce((s, d) => s + d.water, 0)) },
        ]}
      />
    </>
  )
}
