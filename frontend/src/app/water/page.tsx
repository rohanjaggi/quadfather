'use client'

import { useState } from 'react'
import BottleCounter from '@/components/water/BottleCounter'
import SummaryCard from '@/components/dashboard/SummaryCard'

const BOTTLE_SIZE = 0.5 // litres — matches model default
const WATER_GOAL  = 3   // litres

export default function WaterPage() {
  const [count, setCount] = useState(3) // mock: 1.5L already drunk

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
        Water
      </h1>

      <SummaryCard title="Today's Intake">
        <BottleCounter
          count={count}
          goal={WATER_GOAL}
          bottleSize={BOTTLE_SIZE}
          onAdd={() => setCount((c) => Math.min(c + 1, Math.ceil(WATER_GOAL / BOTTLE_SIZE)))}
          onRemove={() => setCount((c) => Math.max(c - 1, 0))}
        />
      </SummaryCard>
    </div>
  )
}
