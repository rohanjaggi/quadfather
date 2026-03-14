import Link from 'next/link'
import GoalRing from '@/components/dashboard/GoalRing'
import SummaryCard from '@/components/dashboard/SummaryCard'

const mockSummary = {
  calories: { total: 1340, goal: 2000 },
  protein:  { total: 87,   goal: 120  },
  water:    { total: 1.5,  goal: 3    },
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
        Today
      </h1>

      <SummaryCard title="Goals">
        <div className="flex justify-around">
          <GoalRing
            label="Calories"
            current={mockSummary.calories.total}
            goal={mockSummary.calories.goal}
            unit="kcal"
            color="#f97316"
          />
          <GoalRing
            label="Protein"
            current={mockSummary.protein.total}
            goal={mockSummary.protein.goal}
            unit="g"
            color="#3b82f6"
          />
          <GoalRing
            label="Water"
            current={mockSummary.water.total}
            goal={mockSummary.water.goal}
            unit="L"
            color="#06b6d4"
          />
        </div>
      </SummaryCard>

      <SummaryCard title="Quick Log">
        <div className="flex gap-3">
          <Link
            href="/food"
            className="flex-1 rounded-xl py-3 text-center text-sm font-semibold"
            style={{
              backgroundColor: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
            }}
          >
            🍽️ Log Meal
          </Link>
          <Link
            href="/water"
            className="flex-1 rounded-xl py-3 text-center text-sm font-semibold"
            style={{
              backgroundColor: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
            }}
          >
            💧 Log Water
          </Link>
        </div>
      </SummaryCard>
    </div>
  )
}
