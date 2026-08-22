'use client'

import { useHaptic } from '@/components/TelegramProvider'

export default function BottleCounter({
  liters,
  bottles,
  goal,
  bottleSize,
  onAdd,
  onRemove,
  pending = false,
  disabled = false,
}: {
  /** Real total logged today, in litres — drives the big number and the bar. */
  liters: number
  /** Whole bottles that total represents — drives the dot row only. */
  bottles: number
  goal: number
  bottleSize: number
  onAdd: () => void
  onRemove: () => void
  /** A bottle add/remove is in flight — blocks taps AND shows "Saving…". */
  pending?: boolean
  /** Blocks taps without claiming this widget is saving (e.g. another
   *  water mutation elsewhere on the page is in flight). */
  disabled?: boolean
}) {
  const haptic = useHaptic()
  const totalBottles = bottleSize > 0 ? Math.ceil(goal / bottleSize) : 0
  const pct = goal > 0 ? Math.min(liters / goal, 1) : 0
  // 1dp normally, 2dp when a custom amount (e.g. 0.25L) would round away
  const tenths = liters * 10
  const litersLabel = Math.abs(tenths - Math.round(tenths)) < 1e-6
    ? liters.toFixed(1)
    : liters.toFixed(2)

  const blocked = pending || disabled

  function handleAdd() {
    if (blocked) return
    haptic.impact('light')
    onAdd()
  }

  function handleRemove() {
    if (blocked) return
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
              backgroundColor: i < bottles ? 'var(--accent-water)' : 'transparent',
              border: `1.5px solid ${i < bottles ? 'var(--accent-water)' : 'var(--surface-border)'}`,
              transition: 'all 0.3s var(--ease-smooth)',
            }}
          />
        ))}
      </div>

      {/* Large display */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '48px',
          fontWeight: 300,
          lineHeight: 1,
          color: 'var(--tg-theme-text-color)',
          letterSpacing: '-0.02em',
        }}>
          {litersLabel}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: 300,
          color: 'var(--tg-theme-hint-color)',
          marginLeft: '3px',
        }}>
          L
        </span>
        <p style={{
          fontFamily: 'var(--font-display)',
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
          disabled={blocked || liters <= 0}
          className="btn-ghost"
          style={{ flex: 1, padding: '14px' }}
        >
          − Remove
        </button>
        <button
          onClick={handleAdd}
          disabled={blocked}
          className="btn-primary"
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: 'var(--accent-water)',
          }}
        >
          {pending ? 'Saving…' : '+ Add Bottle'}
        </button>
      </div>

    </div>
  )
}
