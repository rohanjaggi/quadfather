export default function MealCard({
  name,
  calories,
  protein,
  carbs,
  fats,
  time,
}: {
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  time: string
}) {
  return (
    <div
      className="rounded-xl p-3 flex justify-between items-start"
      style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium text-sm" style={{ color: 'var(--tg-theme-text-color)' }}>
          {name}
        </span>
        <div className="flex gap-2 text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
          <span>P {protein}g</span>
          <span>C {carbs}g</span>
          <span>F {fats}g</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold text-sm" style={{ color: 'var(--tg-theme-text-color)' }}>
          {calories} kcal
        </span>
        <span className="text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
          {time}
        </span>
      </div>
    </div>
  )
}
