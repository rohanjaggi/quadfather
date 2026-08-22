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

/** Reference body weight (kg) that the 0.04 kcal/step constant is calibrated for. */
const REFERENCE_WEIGHT_KG = 70

/** Net energy cost of one walking step for a REFERENCE_WEIGHT_KG adult, in kcal. */
const KCAL_PER_STEP_AT_REFERENCE_WEIGHT = 0.04

/**
 * Extra calorie allowance earned by walking more than the baseline implied by
 * the user's declared activity level (that baseline is already priced into the
 * TDEE activity multiplier, so only the surplus steps earn extra food).
 *
 * Derivation:
 *   Walking costs roughly 0.04 kcal per step for a ~70 kg adult
 *   (~0.5 kcal/kg per km, ~1,250 steps/km → 70 kg * 0.5 / 1250 ≈ 0.04).
 *   Energy cost scales approximately linearly with body mass, so we scale the
 *   constant by weight / 70 rather than multiplying by weight again:
 *
 *     kcal = extraSteps * 0.04 * (weightKg / 70)
 *
 *   e.g. 3,000 extra steps at 75 kg → 3000 * 0.04 * (75/70) ≈ 129 kcal.
 */
export function calculateStepAllowance(
  todaySteps: number,
  activityLevel: ActivityLevel | string | null,
  weightKg: number | null,
): number {
  const level = (activityLevel ?? 'moderately_active') as ActivityLevel
  const weight = weightKg ?? REFERENCE_WEIGHT_KG
  const baseline = ACTIVITY_BASELINE_STEPS[level] ?? 7000

  const extraSteps = Math.max(0, todaySteps - baseline)
  const stepCalories =
    extraSteps * KCAL_PER_STEP_AT_REFERENCE_WEIGHT * (weight / REFERENCE_WEIGHT_KG)
  return Math.round(stepCalories)
}
