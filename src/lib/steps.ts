import type { ActivityLevel } from './tdee'

const ACTIVITY_BASELINE_STEPS: Record<ActivityLevel, number> = {
  sedentary: 3000,
  lightly_active: 5000,
  moderately_active: 7000,
  very_active: 9000,
  extra_active: 11000,
}

export const ACTIVITY_BASELINE_LABELS: Record<ActivityLevel, string> = {
  sedentary: '~3,000 baseline steps/day',
  lightly_active: '~5,000 baseline steps/day',
  moderately_active: '~7,000 baseline steps/day',
  very_active: '~9,000 baseline steps/day',
  extra_active: '~11,000 baseline steps/day',
}

export function calculateStepAllowance(
  todaySteps: number,
  activityLevel: ActivityLevel | string | null,
  weightKg: number | null,
): number {
  const level = (activityLevel ?? 'moderately_active') as ActivityLevel
  const weight = weightKg ?? 70
  const baseline = ACTIVITY_BASELINE_STEPS[level] ?? 7000

  const extraSteps = Math.max(0, todaySteps - baseline)
  const stepCalories = extraSteps * 0.04 * weight
  return Math.round(stepCalories)
}
