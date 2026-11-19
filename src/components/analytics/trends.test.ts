import test from 'node:test'
import assert from 'node:assert/strict'
import { deltaText, goalText, num, periodKeys, splitWindow } from './trends'

const kcal = (n: number) => `${num(n)} kcal`

test('splitWindow puts the cutoff day in the current period', () => {
  const rows = ['2026-11-13', '2026-11-14', '2026-11-20'].map(date => ({ date }))
  const { current, previous } = splitWindow(rows, r => r.date, 7, '2026-11-20')
  assert.deepEqual(current.map(r => r.date), ['2026-11-14', '2026-11-20'])
  assert.deepEqual(previous.map(r => r.date), ['2026-11-13'])
})

test('periodKeys ends today and has one key per day', () => {
  assert.deepEqual(periodKeys(3, '2026-11-01'), ['2026-10-30', '2026-10-31', '2026-11-01'])
})

test('deltaText shows direction, and "same" when the rounded gap is zero', () => {
  assert.equal(deltaText(2140, 2020, kcal, 7), '↑ 120 kcal vs last week')
  assert.equal(deltaText(1900, 2020, kcal, 30), '↓ 120 kcal vs the 30 days before')
  assert.equal(deltaText(2140.2, 2140.4, kcal, 7), 'Same as last week')
  assert.equal(deltaText(2140, null, kcal, 7), null)
})

test('goalText reads under, on, and over', () => {
  assert.deepEqual(goalText(2140, 2400, true, kcal), { text: '260 kcal under your 2,400 kcal goal', over: false })
  assert.deepEqual(goalText(2400, 2400, true, kcal), { text: 'On your 2,400 kcal goal', over: false })
  assert.deepEqual(goalText(2600, 2400, true, kcal), { text: '200 kcal over your 2,400 kcal goal', over: true })
  assert.equal(goalText(2600, 2400, false, kcal)?.text, '200 kcal above your 2,400 kcal goal')
  assert.equal(goalText(100, 0, true, kcal), null)
})
