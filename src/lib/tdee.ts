export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active'

export type FitnessGoal =
  | 'aggressive_cut'
  | 'moderate_cut'
  | 'mild_cut'
  | 'maintenance'
  | 'lean_bulk'
  | 'moderate_bulk'

export interface PersonalDimensions {
  sex: Sex
  weight_kg: number
  height_cm: number
  age: number
  activity_level: ActivityLevel
  fitness_goal: FitnessGoal
}

export interface MacroTargets {
  calories: number
  protein: number
  carbohydrates: number
  fats: number
  fiber: number
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
}

const GOAL_ADJUSTMENTS: Record<FitnessGoal, number> = {
  aggressive_cut: -750,
  moderate_cut: -500,
  mild_cut: -250,
  maintenance: 0,
  lean_bulk: 250,
  moderate_bulk: 500,
}

const PROTEIN_PER_KG: Record<FitnessGoal, number> = {
  aggressive_cut: 2.0,
  moderate_cut: 1.8,
  mild_cut: 1.6,
  maintenance: 1.4,
  lean_bulk: 1.8,
  moderate_bulk: 1.8,
}

const FAT_PCT: Record<FitnessGoal, number> = {
  aggressive_cut: 0.28,
  moderate_cut: 0.27,
  mild_cut: 0.27,
  maintenance: 0.30,
  lean_bulk: 0.25,
  moderate_bulk: 0.25,
}

function calcBMR(sex: Sex, weight_kg: number, height_cm: number, age: number): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function calculateTargets(d: PersonalDimensions): MacroTargets {
  const bmr = calcBMR(d.sex, d.weight_kg, d.height_cm, d.age)
  const tdee = bmr * ACTIVITY_MULTIPLIERS[d.activity_level]
  const calories = Math.max(
    Math.round(tdee + GOAL_ADJUSTMENTS[d.fitness_goal]),
    d.sex === 'male' ? 1500 : 1200,
  )

  let protein = Math.round(d.weight_kg * PROTEIN_PER_KG[d.fitness_goal])
  const fatCals = calories * FAT_PCT[d.fitness_goal]
  let fats = Math.round(fatCals / 9)

  let carbCals = calories - protein * 4 - fats * 9
  if (carbCals < 0) {
    protein = Math.round((calories * 0.4) / 4)
    carbCals = calories - protein * 4 - fats * 9
    if (carbCals < 0) {
      fats = Math.round((calories * 0.2) / 9)
      carbCals = calories - protein * 4 - fats * 9
    }
  }
  const carbohydrates = Math.round(carbCals / 4)

  const fiber = Math.round(calories / 1000 * 14)

  return { calories, protein, carbohydrates, fats, fiber }
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extra_active: 'Extra Active',
}

export const GOAL_LABELS: Record<FitnessGoal, string> = {
  aggressive_cut: 'Aggressive Cut',
  moderate_cut: 'Moderate Cut',
  mild_cut: 'Mild Cut',
  maintenance: 'Maintenance',
  lean_bulk: 'Lean Bulk',
  moderate_bulk: 'Moderate Bulk',
}
