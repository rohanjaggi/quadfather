import PhotoUpload from '@/components/food/PhotoUpload'
import MealCard from '@/components/food/MealCard'
import SummaryCard from '@/components/dashboard/SummaryCard'

const mockMeals = [
  { name: 'Chicken & Rice',   calories: 520, protein: 42, carbs: 55, fats: 8,  time: '12:30' },
  { name: 'Greek Yogurt',     calories: 150, protein: 15, carbs: 12, fats: 3,  time: '10:00' },
  { name: 'Scrambled Eggs',   calories: 280, protein: 18, carbs: 3,  fats: 20, time: '08:15' },
  { name: 'Protein Shake',    calories: 190, protein: 25, carbs: 10, fats: 3,  time: '07:00' },
]

const macroTotals = { protein: 100, carbs: 80, fats: 34, goal: { protein: 120, carbs: 200, fats: 65 } }

export default function FoodPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
        Log Meal
      </h1>

      <PhotoUpload />

      <SummaryCard title="Today's Macros">
        {([
          { label: 'Protein', value: macroTotals.protein, goal: macroTotals.goal.protein, color: '#3b82f6' },
          { label: 'Carbs',   value: macroTotals.carbs,   goal: macroTotals.goal.carbs,   color: '#f97316' },
          { label: 'Fats',    value: macroTotals.fats,    goal: macroTotals.goal.fats,    color: '#eab308' },
        ] as const).map((m) => (
          <div key={m.label} className="flex flex-col gap-1 mb-3 last:mb-0">
            <div className="flex justify-between text-xs" style={{ color: 'var(--tg-theme-hint-color)' }}>
              <span>{m.label}</span>
              <span>{m.value} / {m.goal}g</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(m.value / m.goal * 100, 100)}%`, backgroundColor: m.color }}
              />
            </div>
          </div>
        ))}
      </SummaryCard>

      <SummaryCard title="Today's Meals">
        <div className="flex flex-col gap-2">
          {mockMeals.map((meal) => (
            <MealCard key={meal.name + meal.time} {...meal} />
          ))}
        </div>
      </SummaryCard>
    </div>
  )
}
