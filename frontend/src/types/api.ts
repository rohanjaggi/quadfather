export interface User {
  id: number
  telegram_id: number
  username?: string
  goals: {
    daily_protein_goal: number
    daily_calorie_goal: number
    daily_water_goal: number
  }
  water_bottle_size: number
}

export interface DailySummary {
  date: string
  macros: {
    calories: { total: number; goal: number; remaining: number }
    protein: { total: number; goal: number; remaining: number }
    carbohydrates: number
    fats: number
  }
  water: { total: number; goal: number; remaining: number }
  meals_logged: number
}

export interface FoodLog {
  id: number
  food_name: string
  servings: number
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  source: string
  saved_food_id?: number
  logged_at: string
}

export interface WaterLog {
  id: number
  amount_liters: number
  bottles?: number
  water_bottle_size?: number
  logged_at: string
}

export interface FoodLogCreate {
  food_name: string
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  servings?: number
  source?: string
}

export interface WaterLogCreate {
  amount_liters?: number
  bottles?: number
}
