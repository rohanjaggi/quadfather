'use client'

import { useState } from 'react'
import MealCard from '@/components/food/MealCard'
import ManualFoodForm from '@/components/food/ManualFoodForm'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function FoodPage() {
  const { summary, foodLogs, deleteFood } = useUser()
  const [showForm, setShowForm] = useState(false)

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
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '8px 16px',
            borderRadius: '99px',
            border: '1px solid var(--surface-border)',
            backgroundColor: showForm ? 'var(--tg-theme-button-color)' : 'transparent',
            color: showForm ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          + Add
        </button>
      </div>

      {/* Manual food form */}
      {showForm && (
        <div className="fade-up">
          <SummaryCard title="">
            <ManualFoodForm onClose={() => setShowForm(false)} />
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

      {/* Meals list */}
      <div className="fade-up fade-up-2">
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
