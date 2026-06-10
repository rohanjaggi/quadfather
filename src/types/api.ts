export interface User {
  id: number
  telegram_id: number
  username?: string
  first_name?: string
  goals: {
    daily_calorie_goal: number
    daily_protein_goal: number
    daily_carbs_goal: number
    daily_fats_goal: number
    daily_fiber_goal: number
    daily_water_goal: number
    daily_step_goal: number
  }
  water_bottle_size: number
  ai_provider?: string
  ai_model?: string
  has_api_key: boolean
  dietary_restrictions?: string[]
  ai_features_enabled: boolean
  ai_coaching_prefs?: {
    daily_coach: boolean
    weekly_insights: boolean
    nudge_inactivity: boolean
    nudge_recovery: boolean
    nudge_nutrition_gap: boolean
    nudge_steps: boolean
    nudge_consistency: boolean
  }
  personal?: {
    sex: string
    weight_kg: number
    height_cm: number
    age: number
    activity_level: string
    fitness_goal: string
  }
}

export interface BudgetBreakdown {
  base: number
  runs_raw: number
  runs_credit: number
  workouts_raw: number
  workouts_credit: number
  steps_credit: number
  total: number
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
  steps: { total: number; goal: number; extra_allowance: number }
  meals_logged: number
  exercise_burn: number
  budget: BudgetBreakdown
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
  daily_step_goal?: number
  water_bottle_size?: number
}

export interface PersonalUpdate {
  sex?: string
  weight_kg?: number
  height_cm?: number
  age?: number
  activity_level?: string
  fitness_goal?: string
  dietary_restrictions?: string[]
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
  reason?: string
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
