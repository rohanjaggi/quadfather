'use client'

import Link from 'next/link'
import SavedFoodCard from '@/components/food/SavedFoodCard'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'
import type { SavedFood } from '@/types/api'

export default function FavouritesPage() {
  const { savedFoods, deleteSavedFood, logFood } = useUser()

  async function handleQuickAdd(food: SavedFood) {
    // `saved_food_id` links the log back to the favourite it came from, which
    // is what the heart on each meal row reads — without it the row falls back
    // to matching on the food name, so a rename or a duplicate name gets it
    // wrong. `POST /api/foods` accepts and stores the field; it just isn't on
    // `FoodLogCreate` yet, hence the separate object (an inline literal would
    // trip the excess-property check).
    const payload = {
      food_name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbohydrates: food.carbohydrates,
      fats: food.fats,
      fiber: food.fiber,
      source: food.source,
      saved_food_id: food.id,
    }
    await logFood(payload)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up">
        <Link href="/food" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Food
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px',
          fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>
          Favourites
        </h1>
      </div>

      {/* List */}
      <div className="fade-up fade-up-1">
        <SummaryCard title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Saved Foods</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              fontWeight: 400, color: 'var(--tg-theme-hint-color)',
              letterSpacing: '0', textTransform: 'none',
            }}>
              {savedFoods.length} {savedFoods.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        }>
          {savedFoods.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '22px',
                fontWeight: 400, color: 'var(--tg-theme-hint-color)',
                opacity: 0.6, marginBottom: '6px',
              }}>
                No favourites yet
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '12px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                Heart a meal to save it here
              </p>
            </div>
          ) : (
            <div>
              {savedFoods.map((food, i) => (
                <SavedFoodCard
                  key={food.id}
                  food={food}
                  isLast={i === savedFoods.length - 1}
                  onAdd={handleQuickAdd}
                  onDelete={deleteSavedFood}
                />
              ))}
            </div>
          )}
        </SummaryCard>
      </div>

    </div>
  )
}
