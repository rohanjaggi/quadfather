'use client'

import { useState } from 'react'
import Link from 'next/link'
import MealCard from '@/components/food/MealCard'
import ManualFoodForm from '@/components/food/ManualFoodForm'
import PhotoUpload from '@/components/food/PhotoUpload'
import TextFoodInput from '@/components/food/TextFoodInput'
import MealSuggestions from '@/components/food/MealSuggestions'
import SavedFoodCard from '@/components/food/SavedFoodCard'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'
import type { SavedFood } from '@/types/api'

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
      fiber: food.fiber,
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
      value: summary?.macros.carbohydrates.total ?? 0,
      goal: summary?.macros.carbohydrates.goal ?? 200,
      color: 'var(--accent-calories)',
    },
    {
      label: 'Fats',
      value: summary?.macros.fats.total ?? 0,
      goal: summary?.macros.fats.goal ?? 65,
      color: '#C4A55A',
    },
    {
      label: 'Fiber',
      value: summary?.macros.fiber.total ?? 0,
      goal: summary?.macros.fiber.goal ?? 30,
      color: 'var(--accent-water)',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header + logging panel */}
      <div className="fade-up">
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
            fontSize: '34px',
            fontWeight: 400,
            lineHeight: 1.1,
            color: 'var(--tg-theme-text-color)',
          }}>
            Log a Meal
          </h1>
        </div>

        {/* Input method selector */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '8px',
          marginTop: '20px',
        }}>
          {([
            { key: 'scan' as const, label: 'Scan', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )},
            { key: 'text' as const, label: 'Describe', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
              </svg>
            )},
            { key: 'manual' as const, label: 'Manual', icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )},
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '6px', padding: '14px 8px',
                borderRadius: '14px',
                border: mode === key ? '1.5px solid var(--tg-theme-button-color)' : '1.5px solid var(--surface-border)',
                backgroundColor: mode === key ? 'var(--tg-theme-button-color)' : 'transparent',
                color: mode === key ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
              }}
            >
              {icon}
              {label}
            </button>
          ))}
          <Link href="/water" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '6px', padding: '14px 8px',
            borderRadius: '14px',
            border: '1.5px solid var(--accent-water)',
            backgroundColor: 'transparent',
            color: 'var(--accent-water)',
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.02em',
            textDecoration: 'none',
            transition: 'background-color 0.2s ease',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
            </svg>
            Water
          </Link>
        </div>
      </div>

      {/* Active input panel */}
      {mode && (
        <div className="fade-up" style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '20px',
          padding: '20px',
        }}>
          {mode === 'scan' && <PhotoUpload onClose={() => setMode(null)} />}
          {mode === 'text' && <TextFoodInput onClose={() => setMode(null)} />}
          {mode === 'manual' && <ManualFoodForm onClose={() => setMode(null)} />}
        </div>
      )}

      {/* Macros */}
      <div className="fade-up fade-up-1">
        <SummaryCard title="Macros today">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Calories prominently */}
            {caloriesData && (
              <div>
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--tg-theme-text-color)',
                  marginBottom: '4px',
                  display: 'block',
                }}>
                  Calories
                </span>
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
        <div className="fade-up fade-up-2" style={{ marginTop: '10px' }}>
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
      <div className="fade-up fade-up-3" style={{ marginTop: '10px' }}>
        <SummaryCard>
          <MealSuggestions />
        </SummaryCard>
      </div>

      {/* Meals list */}
      <div className="fade-up fade-up-4" style={{ marginTop: '10px' }}>
        <SummaryCard title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Today&apos;s Meals</span>
            <Link href="/food/history" style={{
              fontFamily: 'var(--font-body)', fontSize: '11px',
              fontWeight: 500, color: 'var(--tg-theme-hint-color)',
              textDecoration: 'none',
            }}>
              History {'→'}
            </Link>
          </div>
        }>
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
                  fiber={Math.round(log.fiber ?? 0)}
                  savedFoodId={log.saved_food_id}
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
