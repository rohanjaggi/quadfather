'use client'

import Link from 'next/link'
import GoalRing from '@/components/dashboard/GoalRing'
import SummaryCard from '@/components/dashboard/SummaryCard'
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
  const { user, summary } = useUser()

  const calories = summary?.macros.calories ?? { total: 0, goal: user?.goals.daily_calorie_goal ?? 2000 }
  const protein = summary?.macros.protein ?? { total: 0, goal: user?.goals.daily_protein_goal ?? 120 }
  const water = summary?.water ?? { total: 0, goal: user?.goals.daily_water_goal ?? 3 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up" style={{ paddingBottom: '4px' }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          fontWeight: 400,
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
          {getGreeting()}
        </h1>
      </div>

      {/* Goal Rings */}
      <div className="fade-up fade-up-1">
        <SummaryCard title="Today's Progress">
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <GoalRing
              label="Calories"
              current={calories.total}
              goal={calories.goal}
              unit="kcal"
              color="var(--accent-calories)"
            />
            <GoalRing
              label="Protein"
              current={protein.total}
              goal={protein.goal}
              unit="g"
              color="var(--accent-protein)"
            />
            <GoalRing
              label="Water"
              current={water.total}
              goal={water.goal}
              unit="L"
              color="var(--accent-water)"
            />
          </div>
        </SummaryCard>
      </div>

      {/* Quick Log */}
      <div className="fade-up fade-up-2" style={{ display: 'flex', gap: '10px' }}>
        <Link
          href="/food"
          style={{
            flex: 1,
            backgroundColor: 'var(--tg-theme-button-color)',
            color: 'var(--tg-theme-button-text-color)',
            borderRadius: '16px',
            padding: '18px 16px',
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 400, lineHeight: 1, fontStyle: 'italic' }}>
            Log
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.6 }}>
            Meal
          </span>
        </Link>

        <Link
          href="/water"
          style={{
            flex: 1,
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            borderRadius: '16px',
            padding: '18px 16px',
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 400, lineHeight: 1, fontStyle: 'italic' }}>
            Log
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.6 }}>
            Water
          </span>
        </Link>
      </div>

    </div>
  )
}
