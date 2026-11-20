import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateMuscleBalance } from './muscle-balance'
import type { WorkoutLog } from '@/types/workouts'

test('full-body exercises count towards every zone', () => {
  const workout = {
    exercises: [
      { exercise_name: 'Burpee Over Bar', sets: [{ reps: 10, weight_kg: 50 }] },
    ],
  } as unknown as WorkoutLog
  const [pushPull, upperLower] = calculateMuscleBalance([workout])
  assert.ok(pushPull.left.value > 0 && pushPull.right.value > 0)
  assert.ok(upperLower.left.value > 0 && upperLower.right.value > 0)
})
