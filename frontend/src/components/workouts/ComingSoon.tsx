export default function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="text-6xl">🏋️</span>
      <h2 className="text-xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
        Coming Soon
      </h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
        Log workouts with natural language. Track sets, reps, and weight — and see your progress over time with muscle-group heatmaps.
      </p>
    </div>
  )
}
