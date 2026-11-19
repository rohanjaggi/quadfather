'use client'

import { useState } from 'react'
import Link from 'next/link'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { formatInt } from '@/lib/format'
import type { FoodLogCreate, SavedFood } from '@/types/api'

export const SAVED_FOODS_ID = 'saved-foods'

/**
 * Logs a saved food. `saved_food_id` links the log back to the favourite it
 * came from, which is what "In your saved foods" reads on each meal; without
 * it the row falls back to matching on the name, so a rename gets it wrong.
 */
export function savedFoodLog(food: SavedFood): FoodLogCreate {
  return {
    food_name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbohydrates: food.carbohydrates,
    fats: food.fats,
    fiber: food.fiber,
    source: food.source,
    saved_food_id: food.id,
  }
}

const linkStyle: React.CSSProperties = { display: 'inline-block', padding: '12px 0', margin: '-12px 0', fontSize: 15, fontWeight: 600, color: 'var(--action)', textDecoration: 'none' }

/** One-tap re-log: a scrolling row of saved-food chips. */
export default function SavedFoodsCard() {
  const { savedFoods, logFood } = useUser()
  const haptic = useHaptic()
  const [pendingId, setPendingId] = useState<number | null>(null)

  async function handleLog(food: SavedFood) {
    if (pendingId !== null) return
    setPendingId(food.id)
    haptic.impact('light')
    try {
      await logFood(savedFoodLog(food))
    } catch (err) {
      toast(errorMessage(err, `Could not log ${food.name}`))
    } finally {
      setPendingId(null)
    }
  }

  // Nothing to re-log yet; the meal estimate card already teaches saving.
  if (savedFoods.length === 0) return null

  return (
    <div id={SAVED_FOODS_ID} style={{ scrollMarginTop: 16, scrollMarginBottom: 120 }}>
      <SummaryCard
        title="Saved foods"
        action={<Link href="/food/favourites" style={linkStyle}>See all</Link>}
      >
        <div
          role="list"
          aria-label="Log a saved food"
          style={{
            display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none',
            margin: '0 -20px', padding: '2px 20px',
          }}
        >
          {savedFoods.map(food => (
            <div role="listitem" key={food.id} style={{ flexShrink: 0 }}>
              <button
                type="button"
                className="btn-pill"
                onClick={() => handleLog(food)}
                disabled={pendingId !== null}
                aria-label={`Log ${food.name}, ${formatInt(food.calories)} kcal`}
                style={{
                  minHeight: 44, maxWidth: 240, display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: pendingId !== null && pendingId !== food.id ? 0.5 : 1,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{food.name}</span>
                <span style={{ color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>
                  {pendingId === food.id ? 'Logging…' : `${formatInt(food.calories)} kcal`}
                </span>
              </button>
            </div>
          ))}
        </div>
      </SummaryCard>
    </div>
  )
}
