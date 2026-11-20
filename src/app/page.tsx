'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import RecentActivity from '@/components/dashboard/RecentActivity'
import HomeScreenOffer from '@/components/dashboard/HomeScreenOffer'
import { useCountTo } from '@/components/dashboard/useCountTo'
import ProgressLine from '@/components/ui/ProgressLine'
import { MacroColumns, StepBlocks, WaterPips } from '@/components/ui/MetricMinis'
import { PlusIcon } from '@/components/ui/icons'
import { formatInt } from '@/lib/format'
import { dayKey } from '@/lib/day'
import { useUser } from '@/context/UserContext'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const weekday = () => new Date().toLocaleDateString('en-GB', { weekday: 'long' })
const dateLine = () => {
  const now = new Date()
  return `${now.toLocaleDateString('en-GB', { month: 'long' })} ${now.getDate()}`
}

export default function TodayPage() {
  const { user, summary, foodLogs, waterLogs, todaySteps, weeklyWorkouts } = useUser()
  const goals = user?.goals

  const calories = summary?.macros.calories ?? { total: 0, goal: goals?.daily_calorie_goal ?? 2000 }
  const protein = summary?.macros.protein ?? { total: 0, goal: goals?.daily_protein_goal ?? 120 }
  const carbs = summary?.macros.carbohydrates ?? { total: 0, goal: goals?.daily_carbs_goal ?? 200 }
  const fats = summary?.macros.fats ?? { total: 0, goal: goals?.daily_fats_goal ?? 65 }
  const fiber = summary?.macros.fiber ?? { total: 0, goal: goals?.daily_fiber_goal ?? 30 }
  const water = summary?.water ?? { total: 0, goal: goals?.daily_water_goal ?? 3 }
  const steps = summary?.steps ?? { total: todaySteps, goal: goals?.daily_step_goal ?? 10000 }
  const budget = summary?.budget
  const credit = budget ? budget.runs_credit + budget.workouts_credit + budget.steps_credit : 0

  // Always answer "what's left": the exercise-adjusted budget when there is
  // one, the plain goal otherwise (the old card vanished on rest days).
  const allowance = budget?.total ?? calories.goal
  const left = Math.round(allowance - calories.total)
  const shownLeft = Math.round(useCountTo(left))
  const proteinToGo = Math.max(0, Math.round(protein.goal - protein.total))

  const name = user?.first_name ?? user?.username
  const today = dayKey()

  // The compact header takes over (and the big date stops being on screen)
  // once the date scrolls away, so only one moving gradient is ever visible.
  const dateRef = useRef<HTMLHeadingElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const el = dateRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const avatar = (size: number) => (
    <Link
      href="/profile"
      aria-label="Settings"
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'grid', placeItems: 'center', textDecoration: 'none',
        background: 'var(--action-soft)', color: 'var(--action)',
        fontSize: size * 0.42, fontWeight: 700,
      }}
    >
      {(name ?? '?').slice(0, 1).toUpperCase()}
    </Link>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Compact header after scroll */}
      <div
        aria-hidden={!compact}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'calc(8px + var(--tg-safe-top, 0px) + var(--tg-content-top, 0px)) 18px 8px', background: 'rgba(243, 238, 232, 0.92)',
          backdropFilter: 'saturate(1.4) blur(16px)', WebkitBackdropFilter: 'saturate(1.4) blur(16px)',
          borderBottom: '1px solid var(--line)',
          transform: compact ? 'none' : 'translateY(-100%)',
          opacity: compact ? 1 : 0,
          transition: 'transform .3s var(--ease-out-expo), opacity .2s ease',
          pointerEvents: compact ? 'auto' : 'none',
        }}
      >
        <span className={compact ? 'text-gradient-animate' : undefined} style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>
          {dateLine()}
        </span>
        {compact && avatar(34)}
      </div>

      <header style={{ padding: '0 2px 6px' }}>
        <h1
          ref={dateRef}
          className={compact ? undefined : 'text-gradient-animate'}
          style={{ margin: 0, fontSize: 52, fontWeight: 700, lineHeight: 1.04, letterSpacing: '-0.035em', whiteSpace: 'nowrap' }}
        >
          {dateLine()}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
          <p style={{ margin: 0, fontSize: 16, color: 'var(--muted)' }}>
            <b style={{ fontWeight: 600, color: 'var(--ink)' }}>{weekday()}</b> · {greeting()}{name ? `, ${name}` : ''}
          </p>
          {avatar(40)}
        </div>
      </header>

      <HomeScreenOffer />

      {/* What's left: the one question this screen answers */}
      <section className="card" aria-labelledby="left-today">
        <h2 id="left-today" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--muted)' }}>
          {left >= 0 ? 'Left today' : 'Over today'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, margin: '2px 0 14px' }}>
          <p style={{ margin: 0, lineHeight: 1 }}>
            <span style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.045em', color: left >= 0 ? 'var(--ink)' : 'var(--over)' }}>
              {formatInt(Math.abs(shownLeft))}
            </span>
            <span style={{ marginLeft: 6, fontSize: 20, fontWeight: 600, color: 'var(--muted)' }}>kcal</span>
          </p>
          <p style={{ margin: 0, paddingBottom: 6, textAlign: 'right', lineHeight: 1.15 }}>
            <span style={{ display: 'block', fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
              {proteinToGo > 0 ? `${proteinToGo} g` : 'Done'}
            </span>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>{proteinToGo > 0 ? 'protein to go' : 'protein goal hit'}</span>
          </p>
        </div>

        {budget && credit > 0 && (
          <details style={{ margin: '-4px 0 14px', fontSize: 14, color: 'var(--muted)' }}>
            <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}>
              Includes +{formatInt(credit)} kcal earned from exercise
            </summary>
            <dl style={{ margin: '6px 0 0', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
              <dt>Daily goal</dt><dd style={{ margin: 0, color: 'var(--ink)' }}>{formatInt(budget.base)}</dd>
              {budget.runs_credit > 0 && <><dt>Runs</dt><dd style={{ margin: 0, color: 'var(--ink)' }}>+{formatInt(budget.runs_credit)}</dd></>}
              {budget.workouts_credit > 0 && <><dt>Workouts</dt><dd style={{ margin: 0, color: 'var(--ink)' }}>+{formatInt(budget.workouts_credit)}</dd></>}
              {budget.steps_credit > 0 && <><dt>Extra steps</dt><dd style={{ margin: 0, color: 'var(--ink)' }}>+{formatInt(budget.steps_credit)}</dd></>}
            </dl>
          </details>
        )}

        <Link href="/food?mode=describe" className="btn-primary" style={{ textDecoration: 'none' }}>
          <PlusIcon size={20} strokeWidth={2} /> Log a meal
        </Link>
      </section>

      {/* Today's totals: long lines for the two that matter, small forms for the rest */}
      <section className="card" aria-label="Today's totals" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProgressLine label="Calories" value={calories.total} goal={allowance} unit="kcal" color="var(--m-calories)" overIsBad />
        <ProgressLine label="Protein" value={protein.total} goal={protein.goal} unit="g" color="var(--m-protein)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <MacroColumns items={[
            { label: 'Carbs', value: carbs.total, goal: carbs.goal, color: 'var(--m-carbs)', overIsBad: true },
            { label: 'Fats', value: fats.total, goal: fats.goal, color: 'var(--m-fats)', overIsBad: true },
            { label: 'Fibre', value: fiber.total, goal: fiber.goal, color: 'var(--m-fibre)' },
          ]} />
          <Link href="/water" aria-label="Water details" style={{ textDecoration: 'none', color: 'inherit' }}>
            <WaterPips liters={water.total} goalLiters={water.goal} bottleSize={user?.water_bottle_size ?? 0.5} />
          </Link>
          <Link href="/workouts/steps" aria-label="Steps details" style={{ textDecoration: 'none', color: 'inherit' }}>
            <StepBlocks steps={steps.total} goal={steps.goal} />
          </Link>
        </div>
      </section>

      <RecentActivity
        foodLogs={foodLogs}
        waterLogs={waterLogs}
        workoutLogs={weeklyWorkouts.filter(w => w.workout_date.startsWith(today))}
      />
    </div>
  )
}
