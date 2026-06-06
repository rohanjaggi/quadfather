import type { ActivityLevel } from './tdee'

const ACTIVITY_BASELINE_STEPS: Record<ActivityLevel, number> = {
  sedentary: 4000,
  lightly_active: 6000,
  moderately_active: 8000,
  very_active: 10000,
  extra_active: 12000,
}

export const ACTIVITY_BASELINE_LABELS: Record<ActivityLevel, string> = {
  sedentary: '~4,000 baseline steps/day',
  lightly_active: '~6,000 baseline steps/day',
  moderately_active: '~8,000 baseline steps/day',
  very_active: '~10,000 baseline steps/day',
  extra_active: '~12,000 baseline steps/day',
}

export function calculateStepAllowance(
  todaySteps: number,
  activityLevel: ActivityLevel | string | null,
  weightKg: number | null,
  runCaloriesAlreadyCounted: number,
): number {
  const level = (activityLevel ?? 'moderately_active') as ActivityLevel
  const weight = weightKg ?? 70
  const baseline = ACTIVITY_BASELINE_STEPS[level] ?? 8000

  const extraSteps = Math.max(0, todaySteps - baseline)
  const stepCalories = extraSteps * 0.04 * weight
  return Math.round(Math.max(0, stepCalories - runCaloriesAlreadyCounted))
}
