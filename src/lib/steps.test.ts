import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateStepAllowance } from './steps'

test('at or below baseline earns nothing', () => {
  assert.equal(calculateStepAllowance(5000, 'lightly_active', 70), 0)
  assert.equal(calculateStepAllowance(100, 'lightly_active', 70), 0)
})

test('above baseline earns kcal', () => {
  assert.equal(calculateStepAllowance(8000, 'lightly_active', 70), 120)
})

test('scales with weight', () => {
  const light = calculateStepAllowance(8000, 'lightly_active', 70)
  const heavy = calculateStepAllowance(8000, 'lightly_active', 140)
  assert.equal(heavy, light * 2)
})

test('null level and weight fall back to moderately_active / 70kg', () => {
  assert.equal(calculateStepAllowance(10_000, null, null), 120)
})
