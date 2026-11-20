import type { Prisma } from '@prisma/client'

// Column sets the API returns as-is, in this key order.
export const FOOD_LOG_SELECT = {
  id: true,
  food_name: true,
  servings: true,
  calories: true,
  protein: true,
  carbohydrates: true,
  fats: true,
  fiber: true,
  source: true,
  saved_food_id: true,
  logged_at: true,
} satisfies Prisma.FoodLogSelect

export const SAVED_FOOD_SELECT = {
  id: true,
  name: true,
  description: true,
  calories: true,
  protein: true,
  carbohydrates: true,
  fats: true,
  fiber: true,
  serving_label: true,
  source: true,
  created_at: true,
} satisfies Prisma.SavedFoodSelect

export const WATER_LOG_SELECT = {
  id: true,
  amount_liters: true,
  bottles: true,
  water_bottle_size: true,
  logged_at: true,
} satisfies Prisma.WaterLogSelect

/** `FoodLog.fiber` is nullable; the API always reports a number. */
export const foodLogRow = <T extends { fiber: number | null }>(log: T) => ({
  ...log,
  fiber: log.fiber ?? 0,
})
