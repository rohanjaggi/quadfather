'use client'

import { useState } from 'react'
import { useHaptic } from '@/components/TelegramProvider'
import { useUser } from '@/context/UserContext'

export default function MealCard({
  name,
  calories,
  protein,
  carbs,
  fats,
  fiber,
  time,
  savedFoodId,
  isLast = false,
  onDelete,
}: {
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  fiber?: number
  time: string
  savedFoodId?: number | null
  isLast?: boolean
  onDelete?: () => void
}) {
  const haptic = useHaptic()
  const { saveFood, savedFoods } = useUser()
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const isFavourited = justSaved || savedFoodId != null ||
    savedFoods.some(f => f.name.toLowerCase() === name.toLowerCase())

  async function handleFavourite() {
    if (isFavourited || saving) return
    setSaving(true)
    try {
      await saveFood({
        name,
        calories,
        protein,
        carbohydrates: carbs,
        fats,
        fiber: fiber ?? 0,
        source: 'logged',
      })
      haptic.notification('success')
      setJustSaved(true)
    } catch {
      haptic.notification('error')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    haptic.notification('warning')
    onDelete?.()
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      paddingTop: '14px',
      paddingBottom: '14px',
      borderBottom: isLast ? 'none' : '1px solid var(--surface-border)',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '19px',
          fontWeight: 600,
          lineHeight: 1.2,
          color: 'var(--tg-theme-text-color)',
          marginBottom: '5px',
        }}>
          {name}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { label: 'P', value: protein },
            { label: 'C', value: carbs },
            { label: 'F', value: fats },
          ].map(({ label, value }) => (
            <span key={label} style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.03em',
              color: 'var(--tg-theme-hint-color)',
            }}>
              {label} {value}g
            </span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--tg-theme-text-color)',
          lineHeight: 1.2,
        }}>
          {calories}
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '9px',
          color: 'var(--tg-theme-hint-color)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {time}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
          <button
            onClick={handleFavourite}
            disabled={isFavourited || saving}
            style={{
              background: 'none',
              border: 'none',
              padding: '0',
              cursor: isFavourited ? 'default' : 'pointer',
              color: isFavourited ? 'var(--accent-calories)' : 'var(--tg-theme-hint-color)',
              fontSize: '16px',
              lineHeight: 1,
              opacity: isFavourited ? 1 : 0.6,
              transition: 'color 0.2s ease, opacity 0.2s ease',
            }}
            aria-label={isFavourited ? 'Already favourited' : 'Save as favourite'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24"
              fill={isFavourited ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                color: 'var(--tg-theme-hint-color)',
                fontSize: '16px',
                lineHeight: 1,
              }}
              aria-label="Delete meal"
            >
              &times;
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
