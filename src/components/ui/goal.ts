/**
 * Where a value sits against its goal. "over" only matters for metrics where
 * exceeding the goal is a problem (calories, carbs, fats); for the rest
 * (protein, fibre, water, steps) going past the goal is still "at".
 */
export type GoalState = 'under' | 'at' | 'over'

// Within 3% of the goal counts as hitting it: 2,390 of 2,400 kcal is done.
const AT_TOLERANCE = 0.03

export function goalState(value: number, goal: number, overIsBad: boolean): GoalState {
  if (!(goal > 0)) return 'under'
  const ratio = value / goal
  if (overIsBad && ratio > 1 + AT_TOLERANCE) return 'over'
  if (ratio >= 1 - AT_TOLERANCE) return 'at'
  return 'under'
}

/** Fill fraction for a bar, clamped to [0, 1]. */
export function fillRatio(value: number, goal: number): number {
  if (!(goal > 0) || !(value > 0)) return 0
  return Math.min(value / goal, 1)
}
