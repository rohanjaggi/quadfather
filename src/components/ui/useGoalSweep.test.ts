import test from 'node:test'
import assert from 'node:assert/strict'
import { AFTER_LANDING_MS, SWEEP_MS, nextSweepDelay } from './useGoalSweep'

test('two goals crossed by one log sweep one after the other', () => {
  const now = 1_000_000
  const first = nextSweepDelay(now)
  const second = nextSweepDelay(now)
  assert.equal(first, AFTER_LANDING_MS)
  assert.equal(second, AFTER_LANDING_MS + SWEEP_MS)
})

test('a later log waits only for the landing wash', () => {
  const later = 2_000_000
  assert.equal(nextSweepDelay(later), AFTER_LANDING_MS)
})
