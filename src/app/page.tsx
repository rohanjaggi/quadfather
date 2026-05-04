'use client'

import GoalRing from '@/components/dashboard/GoalRing'
import CollapsibleSection from '@/components/dashboard/CollapsibleSection'
import LogActions from '@/components/dashboard/LogActions'
import RecentActivity from '@/components/dashboard/RecentActivity'
import { useUser } from '@/context/UserContext'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default function DashboardPage() {
  const { user, summary, foodLogs, waterLogs } = useUser()

  const calories = summary?.macros.calories ?? { total: 0, goal: user?.goals.daily_calorie_goal ?? 2000 }
  const protein = summary?.macros.protein ?? { total: 0, goal: user?.goals.daily_protein_goal ?? 120 }
  const water = summary?.water ?? { total: 0, goal: user?.goals.daily_water_goal ?? 3 }
  const carbs = summary?.macros.carbohydrates ?? { total: 0, goal: user?.goals.daily_carbs_goal ?? 200 }
  const fats = summary?.macros.fats ?? { total: 0, goal: user?.goals.daily_fats_goal ?? 65 }
  const fiber = summary?.macros.fiber ?? { total: 0, goal: user?.goals.daily_fiber_goal ?? 30 }

  const displayName = user?.first_name ?? user?.username

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header with personalized greeting */}
      <div className="fade-up" style={{ paddingBottom: '4px' }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '5px',
        }}>
          {formatDate()}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          fontWeight: 400,
          lineHeight: 1.1,
          color: 'var(--tg-theme-text-color)',
          letterSpacing: '-0.01em',
        }}>
          {getGreeting()}{displayName ? `, ${displayName}` : ''}
        </h1>
      </div>

      {/* Log Actions */}
      <div className="fade-up fade-up-1">
        <LogActions />
      </div>

      {/* Collapsible Progress */}
      <div className="fade-up fade-up-2">
        <CollapsibleSection title="Today's Progress" defaultOpen={true}>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
            <GoalRing label="Calories" current={calories.total} goal={calories.goal} unit="kcal" color="var(--accent-calories)" />
            <GoalRing label="Protein" current={protein.total} goal={protein.goal} unit="g" color="var(--accent-protein)" />
            <GoalRing label="Water" current={water.total} goal={water.goal} unit="L" color="var(--accent-water)" />
          </div>

          {/* Extended macros */}
          <div style={{
            borderTop: '1px solid var(--surface-border)',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {[
              { label: 'Carbs', value: carbs.total, goal: carbs.goal, color: 'var(--accent-calories)' },
              { label: 'Fats', value: fats.total, goal: fats.goal, color: '#C4A55A' },
              { label: 'Fiber', value: fiber.total, goal: fiber.goal, color: 'var(--accent-water)' },
            ].map((m) => (
              <div key={m.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
                    {m.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
                    {Math.round(m.value)}<span style={{ fontWeight: 500, opacity: 0.65 }}> / {m.goal}g</span>
                  </span>
                </div>
                <div style={{ height: '3px', borderRadius: '99px', backgroundColor: 'var(--tg-theme-bg-color)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: '99px',
                    width: `${Math.min(m.value / m.goal * 100, 100)}%`,
                    backgroundColor: m.color,
                    transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Recent Activity */}
      <div className="fade-up fade-up-3">
        <RecentActivity foodLogs={foodLogs} waterLogs={waterLogs} />
      </div>

    </div>
  )
}
