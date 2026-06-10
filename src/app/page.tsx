'use client'

import GoalRing from '@/components/dashboard/GoalRing'
import BudgetBreakdown from '@/components/dashboard/BudgetBreakdown'
import LogActions from '@/components/dashboard/LogActions'
import RecentActivity from '@/components/dashboard/RecentActivity'
import { useUser } from '@/context/UserContext'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getDayOfWeek() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()
}

function getDateDisplay() {
  const now = new Date()
  const month = now.toLocaleDateString('en-GB', { month: 'long' })
  const day = now.getDate()
  return `${month} ${day}`
}

export default function DashboardPage() {
  const { user, summary, foodLogs, waterLogs, todaySteps, weeklyWorkouts } = useUser()

  const calories = summary?.macros.calories ?? { total: 0, goal: user?.goals.daily_calorie_goal ?? 2000 }
  const protein = summary?.macros.protein ?? { total: 0, goal: user?.goals.daily_protein_goal ?? 120 }
  const water = summary?.water ?? { total: 0, goal: user?.goals.daily_water_goal ?? 3 }
  const carbs = summary?.macros.carbohydrates ?? { total: 0, goal: user?.goals.daily_carbs_goal ?? 200 }
  const fats = summary?.macros.fats ?? { total: 0, goal: user?.goals.daily_fats_goal ?? 65 }
  const fiber = summary?.macros.fiber ?? { total: 0, goal: user?.goals.daily_fiber_goal ?? 30 }
  const steps = summary?.steps ?? { total: todaySteps, goal: user?.goals.daily_step_goal ?? 10000, extra_allowance: 0 }

  const displayName = user?.first_name ?? user?.username

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header */}
      <div className="fade-up">
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '8px',
        }}>
          {getDayOfWeek()}
        </p>
        <h1 className="text-gradient-animate" style={{
          fontSize: '52px',
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.05em',
          marginBottom: '12px',
        }}>
          {getDateDisplay()}
        </h1>
        <p style={{
          fontSize: '16px',
          fontWeight: 400,
          color: 'var(--tg-theme-hint-color)',
        }}>
          {getGreeting()}{displayName ? ', ' : ''}{displayName && (
            <span style={{ fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>{displayName}</span>
          )}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="fade-up fade-up-1">
        <LogActions />
      </div>

      {/* Progress Rings */}
      <div className="fade-up fade-up-2">
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '16px',
        }}>
          Today
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '28px' }}>
          <GoalRing label="Calories" current={calories.total} goal={calories.goal} unit="kcal" color="var(--accent-calories)" />
          <GoalRing label="Protein" current={protein.total} goal={protein.goal} unit="g" color="var(--accent-protein)" />
          <GoalRing label="Steps" current={steps.total} goal={steps.goal} unit="steps" color="var(--accent-steps)" />
        </div>
        {/* Macro bars */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '18px',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        }}>
          {[
            { label: 'Carbs', value: carbs.total, goal: carbs.goal, color: 'var(--accent-calories)', unit: 'g' },
            { label: 'Fats', value: fats.total, goal: fats.goal, color: 'var(--accent-fats)', unit: 'g' },
            { label: 'Fiber', value: fiber.total, goal: fiber.goal, color: 'var(--accent-water)', unit: 'g' },
            { label: 'Water', value: water.total, goal: water.goal, color: 'var(--accent-water)', unit: 'L' },
          ].map((m) => (
            <div key={m.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontFamily: 'var(--font-display)' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
                  {m.label}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
                  {m.unit === 'L' ? m.value.toFixed(1) : Math.round(m.value)} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--tg-theme-hint-color)', opacity: 0.75 }}>/ {m.unit === 'L' ? m.goal.toFixed(1) : m.goal}{m.unit}</span>
                </span>
              </div>
              <div style={{ height: '4px', borderRadius: '99px', backgroundColor: 'var(--tg-theme-bg-color)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: '99px',
                  width: `${Math.min(m.value / m.goal * 100, 100)}%`,
                  backgroundColor: m.color,
                  transition: 'width 0.7s var(--ease-out-expo)',
                }} />
              </div>
            </div>
          ))}
        </div>

        {summary?.budget && (
          <div style={{ marginTop: '14px' }}>
            <BudgetBreakdown budget={summary.budget} consumed={calories.total} />
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="fade-up fade-up-3">
        <RecentActivity foodLogs={foodLogs} waterLogs={waterLogs} workoutLogs={weeklyWorkouts.filter(w => {
          const today = new Date().toISOString().split('T')[0]
          return w.workout_date.startsWith(today)
        })} />
      </div>

    </div>
  )
}
