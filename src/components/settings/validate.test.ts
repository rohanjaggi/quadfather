import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkNumber, parseNumber } from './validate'

test('thousands separators are stripped, decimal commas are points', () => {
  assert.equal(parseNumber('2,400'), 2400)
  assert.equal(parseNumber('2,5', true), 2.5)
  assert.ok(Number.isNaN(parseNumber('  ')))
})

test('range, integer and empty checks', () => {
  const kcal = { min: 1000, max: 6000 }
  assert.equal(checkNumber('2400', kcal), null)
  assert.equal(checkNumber('', kcal), 'Enter a number.')
  assert.equal(checkNumber('abc', kcal), 'Enter a number.')
  assert.equal(checkNumber('99999', kcal), 'Use a number from 1,000 to 6,000.')
  assert.equal(checkNumber('8000.5', { min: 1000, max: 50000, integer: true }), 'Use a whole number.')
  assert.equal(checkNumber('0,5', { min: 0.5, max: 8, decimal: true }), null)
})
