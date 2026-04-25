'use client'

import { useHaptic } from '@/components/TelegramProvider'

export default function MealCard({
  name,
  calories,
  protein,
  carbs,
  fats,
  time,
  isLast = false,
  onDelete,
}: {
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  time: string
  isLast?: boolean
  onDelete?: () => void
}) {
  const haptic = useHaptic()

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
              marginTop: '2px',
            }}
            aria-label="Delete meal"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
