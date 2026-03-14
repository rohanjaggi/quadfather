'use client'

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
  const totalBottles = Math.ceil(goal / bottleSize)
  const liters = count * bottleSize
  const pct = Math.min(liters / goal, 1)

  return (
    <div className="flex flex-col gap-4">
      {/* Bottle icons */}
      <div className="flex flex-wrap gap-3 justify-center">
        {Array.from({ length: totalBottles }).map((_, i) => (
          <button
            key={i}
            onClick={i < count ? onRemove : onAdd}
            className="text-4xl transition-transform active:scale-90"
            style={{ opacity: i < count ? 1 : 0.25 }}
            aria-label={i < count ? 'Remove bottle' : 'Add bottle'}
          >
            💧
          </button>
        ))}
      </div>

      {/* Liters label */}
      <div className="text-center">
        <span className="text-3xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
          {liters.toFixed(1)}L
        </span>
        <span className="text-sm ml-1" style={{ color: 'var(--tg-theme-hint-color)' }}>
          / {goal}L goal
        </span>
      </div>

      {/* Animated water fill bar */}
      <div
        className="h-4 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: '#06b6d4',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onRemove}
          disabled={count === 0}
          className="flex-1 rounded-xl py-3 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            opacity: count === 0 ? 0.4 : 1,
          }}
        >
          − Remove
        </button>
        <button
          onClick={onAdd}
          disabled={count >= totalBottles}
          className="flex-1 rounded-xl py-3 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--tg-theme-button-color)',
            color: 'var(--tg-theme-button-text-color)',
            opacity: count >= totalBottles ? 0.4 : 1,
          }}
        >
          + Add Bottle
        </button>
      </div>
    </div>
  )
}
