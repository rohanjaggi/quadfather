export interface User {
  id: number
  telegram_id: number
  username?: string
  goals: {
    daily_calorie_goal: number
    daily_protein_goal: number
    daily_carbs_goal: number
    daily_fats_goal: number
    daily_fiber_goal: number
    daily_water_goal: number
  }
  water_bottle_size: number
  ai_provider?: string
  has_api_key: boolean
  strava_connected: boolean
  personal?: {
    sex: string
    weight_kg: number
    height_cm: number
    age: number
    activity_level: string
    fitness_goal: string
  }
}

export interface DailySummary {
  date: string
  macros: {
    calories: { total: number; goal: number; remaining: number }
    protein: { total: number; goal: number; remaining: number }
    carbohydrates: { total: number; goal: number; remaining: number }
    fats: { total: number; goal: number; remaining: number }
    fiber: { total: number; goal: number; remaining: number }
  }
  water: { total: number; goal: number; remaining: number }
  meals_logged: number
  exercise_burn: number
}

export interface FoodLog {
  id: number
  food_name: string
  servings: number
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
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
  fiber?: number
  servings?: number
  source?: string
}

export interface WaterLogCreate {
  amount_liters?: number
  bottles?: number
}

export interface MealAnalysis {
  food_name: string
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

export interface GoalsUpdate {
  daily_calorie_goal?: number
  daily_protein_goal?: number
  daily_carbs_goal?: number
  daily_fats_goal?: number
  daily_fiber_goal?: number
  daily_water_goal?: number
  water_bottle_size?: number
}

export interface PersonalUpdate {
  sex?: string
  weight_kg?: number
  height_cm?: number
  age?: number
  activity_level?: string
  fitness_goal?: string
}

export interface SavedFood {
  id: number
  name: string
  description?: string
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
  serving_label?: string
  source: string
  created_at: string
}

export interface SavedFoodCreate {
  name: string
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber?: number
  description?: string
  serving_label?: string
  source?: string
}

export interface MealSuggestion {
  name: string
  description: string
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
}

export interface AnalyticsDayData {
  date: string
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
  water: number
  meals_logged: number
}

export interface AnalyticsResponse {
  days: AnalyticsDayData[]
  goals: {
    calories: number
    protein: number
    carbohydrates: number
    fats: number
    fiber: number
    water: number
  }
}
