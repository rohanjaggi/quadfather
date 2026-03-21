'use client'

import BottleCounter from '@/components/water/BottleCounter'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'

export default function WaterPage() {
  const { user, summary, waterLogs, logWater, deleteWater } = useUser()

  const totalLiters = summary?.water.total ?? 0
  const goal = user?.goals.daily_water_goal ?? 3
  const bottleSize = user?.water_bottle_size ?? 0.5
  const currentBottles = Math.round(totalLiters / bottleSize)
  const totalBottles = Math.ceil(goal / bottleSize)

  async function handleAdd() {
    await logWater({ bottles: 1 })
  }

  async function handleRemove() {
    if (waterLogs.length > 0) {
      await deleteWater(waterLogs[0].id)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up">
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '5px',
        }}>
          Hydration
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          fontWeight: 400,
          lineHeight: 1.1,
          color: 'var(--tg-theme-text-color)',
        }}>
          Water Intake
        </h1>
      </div>

      {/* Counter */}
      <div className="fade-up fade-up-1">
        <SummaryCard title="Today's Hydration">
          <BottleCounter
            count={currentBottles}
            goal={goal}
            bottleSize={bottleSize}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </SummaryCard>
      </div>

    </div>
  )
}
