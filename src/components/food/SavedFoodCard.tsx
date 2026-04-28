'use client'

import { useHaptic } from '@/components/TelegramProvider'
import type { SavedFood } from '@/types/api'

interface Props {
  food: SavedFood
  onAdd: (food: SavedFood) => void
  onDelete: (id: number) => void
  isLast: boolean
}

export default function SavedFoodCard({ food, onAdd, onDelete, isLast }: Props) {
  const haptic = useHaptic()

  function handleAdd() {
    haptic.impact('light')
    onAdd(food)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      paddingBottom: isLast ? 0 : '14px',
      marginBottom: isLast ? 0 : '14px',
      borderBottom: isLast ? 'none' : '1px solid var(--surface-border)',
    }}>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--tg-theme-text-color)',
          marginBottom: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {food.name}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: 'var(--tg-theme-hint-color)',
        }}>
          {Math.round(food.calories)} kcal · {Math.round(food.protein)}g P · {Math.round(food.carbohydrates)}g C · {Math.round(food.fats)}g F · {Math.round(food.fiber)}g Fi
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(food.id)}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px',
          cursor: 'pointer',
          opacity: 0.35,
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--tg-theme-text-color)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>

      {/* Add to today */}
      <button
        onClick={handleAdd}
        className="btn-primary"
        style={{
          padding: '8px 14px',
          borderRadius: '99px',
          fontSize: '12px',
          flexShrink: 0,
        }}
      >
        + Add
      </button>

    </div>
  )
}
