import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runKcal } from './constants'

test('runKcal is km x kg x 1.036, rounded', () => {
  assert.equal(runKcal(5, 70), 363)
  assert.equal(runKcal(0, 70), 0)
  assert.equal(runKcal(10.5, 80), 870)
})
