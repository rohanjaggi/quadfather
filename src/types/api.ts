/**
 * Every AI-coaching toggle the app knows about — the single source of truth for
 * both the settings screen and `User.ai_coaching_prefs`.
 *
 * Always consumed as `Partial<CoachingPrefs>`: the column is free-form JSON, so
 * a row written before a key existed simply won't have it. Read a missing key
 * as "on" (`!== false`) or merge over a full defaults object; never assume the
 * stored object is complete.
 */
export interface CoachingPrefs {
  daily_coach: boolean
  weekly_insights: boolean
  nudge_inactivity: boolean
  nudge_recovery: boolean
  nudge_nutrition_gap: boolean
  nudge_steps: boolean
  nudge_consistency: boolean
  pre_workout_suggestions: boolean
  workout_analysis: boolean
  weekly_exercise_digest: boolean
}

export interface User {
  id: number
  telegram_id: number
  /** `null` (not absent) when the Telegram account has no @username. */
  username?: string | null
  /** `null` (not absent) when `initData` carried no first name. */
  first_name?: string | null
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
  ai_provider?: string | null
  ai_model?: string | null
  has_api_key: boolean
  dietary_restrictions?: string[]
  ai_features_enabled: boolean
  ai_coaching_prefs?: Partial<CoachingPrefs>
  /**
   * `'strength' | 'hypertrophy'`, or `null` for "general" — kept as a plain
   * string because the route validates the enum and the column is free-form.
   */
  training_focus?: string | null
  personal?: {
    sex: string
    weight_kg: number
    height_cm: number
    age: number
    activity_level: string
    fitness_goal: string
  }
  strava_connected: boolean
  /** False when connected but the granted Strava scope lacks activity read. */
  strava_scope_ok: boolean
  strava_last_synced_at: string | null
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
  saved_food_id?: number
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

/**
 * What `PUT /users/me/goals` actually sends back — notably *not* a `User`.
 * `personal` is omitted entirely until a sex has been recorded, and every
 * dimension inside it is nullable.
 *
 * No caller reads this today (they all re-fetch the user instead); it exists so
 * the three wrappers hitting this one route can't drift back into claiming
 * three different, wrong shapes.
 */
export interface GoalsUpdateResult {
  message: string
  goals: {
    daily_calorie_goal: number
    daily_protein_goal: number
    daily_carbs_goal: number
    daily_fats_goal: number
    daily_fiber_goal: number
    daily_water_goal: number
    daily_step_goal: number
  }
  personal?: {
    sex: string
    weight_kg: number | null
    height_cm: number | null
    age: number | null
    activity_level: string | null
    fitness_goal: string | null
  }
  water_bottle_size: number
  dietary_restrictions: string[]
  ai_features_enabled: boolean
  ai_coaching_prefs?: Partial<CoachingPrefs>
  training_focus: string | null
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
