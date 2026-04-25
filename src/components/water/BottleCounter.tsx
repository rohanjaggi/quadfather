'use client'

import { useHaptic } from '@/components/TelegramProvider'

export default function BottleCounter({
  count,
  goal,
  bottleSize,
  onAdd,
  onRemove,
}: {
  count: number
  goal: number
  bottleSize: number
  onAdd: () => void
  onRemove: () => void
}) {
  const haptic = useHaptic()
  const totalBottles = Math.ceil(goal / bottleSize)
  const liters = count * bottleSize
  const pct = Math.min(liters / goal, 1)

  function handleAdd() {
    haptic.impact('light')
    onAdd()
  }

  function handleRemove() {
    haptic.impact('light')
    onRemove()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Dot indicators */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {Array.from({ length: totalBottles }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: i < count ? 'var(--accent-water)' : 'transparent',
              border: `1.5px solid ${i < count ? 'var(--accent-water)' : 'var(--surface-border)'}`,
              transition: 'all 0.3s var(--ease-smooth)',
            }}
          />
        ))}
      </div>

      {/* Large display */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '60px',
          fontWeight: 400,
          lineHeight: 1,
          color: 'var(--tg-theme-text-color)',
        }}>
          {liters.toFixed(1)}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '30px',
          fontWeight: 400,
          color: 'var(--tg-theme-hint-color)',
          marginLeft: '4px',
        }}>
          L
        </span>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginTop: '6px',
        }}>
          of {goal}L goal
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '2px',
        borderRadius: '99px',
        backgroundColor: 'var(--tg-theme-bg-color)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: '99px',
          width: `${pct * 100}%`,
          backgroundColor: 'var(--accent-water)',
          transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleRemove}
          disabled={count === 0}
          className="btn-ghost"
          style={{ flex: 1, padding: '14px' }}
        >
          − Remove
        </button>
        <button
          onClick={handleAdd}
          disabled={count >= totalBottles}
          className="btn-primary"
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: 'var(--accent-water)',
          }}
        >
          + Add Bottle
        </button>
      </div>

    </div>
  )
}
