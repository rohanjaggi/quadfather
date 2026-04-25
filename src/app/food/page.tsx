'use client'

import { useState } from 'react'
import MealCard from '@/components/food/MealCard'
import ManualFoodForm from '@/components/food/ManualFoodForm'
import PhotoUpload from '@/components/food/PhotoUpload'
import TextFoodInput from '@/components/food/TextFoodInput'
import MealSuggestions from '@/components/food/MealSuggestions'
import SavedFoodCard from '@/components/food/SavedFoodCard'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'
import type { SavedFood } from '@/types/api'

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

type Mode = null | 'scan' | 'manual' | 'text'

export default function FoodPage() {
  const { summary, foodLogs, deleteFood, savedFoods, deleteSavedFood, logFood } = useUser()
  const [mode, setMode] = useState<Mode>(null)

  function toggle(next: Mode) {
    setMode(prev => prev === next ? null : next)
  }

  async function handleQuickAdd(food: SavedFood) {
    await logFood({
      food_name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbohydrates: food.carbohydrates,
      fats: food.fats,
      source: food.source,
    })
  }

  const caloriesData = summary?.macros.calories
  const macros = [
    {
      label: 'Protein',
      value: summary?.macros.protein.total ?? 0,
      goal: summary?.macros.protein.goal ?? 120,
      color: 'var(--accent-protein)',
    },
    {
      label: 'Carbs',
      value: summary?.macros.carbohydrates ?? 0,
      goal: 200,
      color: 'var(--accent-calories)',
    },
    {
      label: 'Fats',
      value: summary?.macros.fats ?? 0,
      goal: 65,
      color: '#C4A55A',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)',
            marginBottom: '5px',
          }}>
            Nutrition
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '36px',
            fontWeight: 400,
            lineHeight: 1.1,
            color: 'var(--tg-theme-text-color)',
          }}>
            Log a Meal
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => toggle('scan')}
            style={{
              padding: '8px 14px',
              borderRadius: '99px',
              border: '1px solid var(--surface-border)',
              backgroundColor: mode === 'scan' ? 'var(--tg-theme-button-color)' : 'transparent',
              color: mode === 'scan' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            📷 Scan
          </button>
          <button
            onClick={() => toggle('text')}
            style={{
              padding: '8px 14px',
              borderRadius: '99px',
              border: '1px solid var(--surface-border)',
              backgroundColor: mode === 'text' ? 'var(--tg-theme-button-color)' : 'transparent',
              color: mode === 'text' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ✏️ Text
          </button>
          <button
            onClick={() => toggle('manual')}
            style={{
              padding: '8px 14px',
              borderRadius: '99px',
              border: '1px solid var(--surface-border)',
              backgroundColor: mode === 'manual' ? 'var(--tg-theme-button-color)' : 'transparent',
              color: mode === 'manual' ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Scan mode */}
      {mode === 'scan' && (
        <div className="fade-up">
          <SummaryCard>
            <PhotoUpload onClose={() => setMode(null)} />
          </SummaryCard>
        </div>
      )}

      {/* Text mode */}
      {mode === 'text' && (
        <div className="fade-up">
          <SummaryCard>
            <TextFoodInput onClose={() => setMode(null)} />
          </SummaryCard>
        </div>
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <div className="fade-up">
          <SummaryCard>
            <ManualFoodForm onClose={() => setMode(null)} />
          </SummaryCard>
        </div>
      )}

      {/* Macros */}
      <div className="fade-up fade-up-1">
        <SummaryCard title="Macros today">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Calories prominently */}
            {caloriesData && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    fontWeight: 600,
                    color: 'var(--tg-theme-text-color)',
                    lineHeight: 1,
                  }}>
                    {Math.round(caloriesData.total)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--tg-theme-hint-color)',
                    alignSelf: 'flex-end',
                  }}>
                    / {caloriesData.goal} kcal
                  </span>
                </div>
                <div style={{
                  height: '4px',
                  borderRadius: '99px',
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  overflow: 'hidden',
                  marginBottom: '4px',
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: '99px',
                    width: `${Math.min(caloriesData.total / caloriesData.goal * 100, 100)}%`,
                    backgroundColor: 'var(--accent-calories)',
                    transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
              </div>
            )}

            {/* Protein / Carbs / Fats */}
            {macros.map((m) => (
              <div key={m.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--tg-theme-text-color)',
                  }}>
                    {m.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--tg-theme-hint-color)',
                  }}>
                    {Math.round(m.value)}<span style={{ opacity: 0.55 }}> / {m.goal}g</span>
                  </span>
                </div>
                <div style={{
                  height: '3px',
                  borderRadius: '99px',
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  overflow: 'hidden',
                }}>
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
        </SummaryCard>
      </div>

      {/* Favourites */}
      {savedFoods.length > 0 && (
        <div className="fade-up fade-up-2">
          <SummaryCard title="Favourites">
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
          </SummaryCard>
        </div>
      )}

      {/* AI Suggestions */}
      <div className="fade-up fade-up-3">
        <SummaryCard>
          <MealSuggestions />
        </SummaryCard>
      </div>

      {/* Meals list */}
      <div className="fade-up fade-up-4">
        <SummaryCard title="Today's Meals">
          <div>
            {foodLogs.length === 0 ? (
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--tg-theme-hint-color)',
                textAlign: 'center',
                padding: '16px 0',
              }}>
                No meals logged yet
              </p>
            ) : (
              foodLogs.map((log, i) => (
                <MealCard
                  key={log.id}
                  name={log.food_name}
                  calories={Math.round(log.calories)}
                  protein={Math.round(log.protein)}
                  carbs={Math.round(log.carbohydrates)}
                  fats={Math.round(log.fats)}
                  time={formatTime(log.logged_at)}
                  isLast={i === foodLogs.length - 1}
                  onDelete={() => deleteFood(log.id)}
                />
              ))
            )}
          </div>
        </SummaryCard>
      </div>

    </div>
  )
}
