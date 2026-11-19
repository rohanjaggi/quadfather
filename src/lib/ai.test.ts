import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonObject, coerceNumber, sgtMealTimeLabel } from './ai'
import { ApiError } from './api-handler'

test('parseJsonObject handles fenced JSON', () => {
  assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 })
})

test('parseJsonObject handles prose around JSON', () => {
  assert.deepEqual(parseJsonObject('Sure! Here you go: {"a":{"b":2}} hope it helps'), { a: { b: 2 } })
})

test('parseJsonObject throws a 422 ApiError on empty, array, and garbage', () => {
  const is422 = (re: RegExp) => (e: unknown) =>
    e instanceof ApiError && e.status === 422 && re.test(e.message)
  assert.throws(() => parseJsonObject(''), is422(/empty answer/))
  assert.throws(() => parseJsonObject('[1,2]'), is422(/Failed to parse/))
  assert.throws(() => parseJsonObject('{nope}'), is422(/Failed to parse/))
})

test('sgtMealTimeLabel wraps past midnight Singapore time', () => {
  assert.match(sgtMealTimeLabel(21), /morning/) // 05:00 SGT
  assert.match(sgtMealTimeLabel(0), /morning/) // 08:00 SGT
  assert.match(sgtMealTimeLabel(4), /midday/) // 12:00 SGT
  assert.match(sgtMealTimeLabel(14), /late night/) // 22:00 SGT
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
