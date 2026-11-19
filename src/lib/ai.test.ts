import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonObject, coerceNumber } from './ai'

test('parseJsonObject handles fenced JSON', () => {
  assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 })
})

test('parseJsonObject handles prose around JSON', () => {
  assert.deepEqual(parseJsonObject('Sure! Here you go: {"a":{"b":2}} hope it helps'), { a: { b: 2 } })
})

test('parseJsonObject throws on empty, array, and garbage', () => {
  assert.throws(() => parseJsonObject(''), /empty response/)
  assert.throws(() => parseJsonObject('[1,2]'), /Failed to parse/)
  assert.throws(() => parseJsonObject('{nope}'), /Failed to parse/)
})

test('coerceNumber', () => {
  assert.equal(coerceNumber('.5'), 0.5)
  assert.equal(coerceNumber('1e3'), 1000)
  assert.equal(coerceNumber('~500 kcal'), 500)
  assert.equal(coerceNumber('1,200'), 1200)
  assert.equal(coerceNumber('abc'), null)
  assert.equal(coerceNumber(null), null)
  assert.equal(coerceNumber(NaN), null)
  assert.equal(coerceNumber(12), 12)
})
