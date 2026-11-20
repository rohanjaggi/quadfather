import { formatInt } from '@/lib/format'
import type { FoodLog } from '@/types/api'

type Macros = { protein: number; carbohydrates: number; fats: number; fiber?: number | null }

/** "32 g protein · 80 g carbs · 18 g fat", optionally with fibre. */
export function macroLine(m: Macros, withFibre = false): string {
  const parts = [`${formatInt(m.protein)} g protein`, `${formatInt(m.carbohydrates)} g carbs`, `${formatInt(m.fats)} g fat`]
  if (withFibre) parts.push(`${formatInt(m.fiber ?? 0)} g fibre`)
  return parts.join(' · ')
}

export const PARTS_OF_DAY = ['Morning', 'Midday', 'Afternoon', 'Evening'] as const
export type PartOfDay = typeof PARTS_OF_DAY[number]

/** Device-local hour, the same clock `formatTime` shows next to each row. */
export function partOfDay(iso: string): PartOfDay {
  const h = new Date(iso).getHours()
  return h < 11 ? 'Morning' : h < 15 ? 'Midday' : h < 18 ? 'Afternoon' : 'Evening'
}

/** Meals in time order, bucketed by part of day; empty buckets are dropped. */
export function groupByPartOfDay(logs: FoodLog[]): { label: PartOfDay; logs: FoodLog[]; kcal: number }[] {
  const sorted = [...logs].sort((a, b) => Date.parse(a.logged_at) - Date.parse(b.logged_at))
  return PARTS_OF_DAY
    .map(label => {
      const inPart = sorted.filter(l => partOfDay(l.logged_at) === label)
      return { label, logs: inPart, kcal: inPart.reduce((s, l) => s + l.calories, 0) }
    })
    .filter(g => g.logs.length > 0)
}

/** What a part of day is called when it's one meal: "Same as yesterday's lunch". */
export const MEAL_NAME: Record<PartOfDay, string> = {
  Morning: 'breakfast', Midday: 'lunch', Afternoon: 'snack', Evening: 'dinner',
}

/**
 * The newest occurrence of each meal, by case-insensitive trimmed name, up to
 * `limit`. `logs` must already be newest first.
 */
export function distinctRecent<T extends { food_name: string }>(logs: T[], limit = 10): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const log of logs) {
    const key = log.food_name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(log)
    if (out.length === limit) break
  }
  return out
}
