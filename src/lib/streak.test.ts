import test from 'node:test'
import assert from 'node:assert/strict'
import { currentStepStreak, longestStepStreak } from './streak'

const r = (date: string, steps: number) => ({ date, steps })

test('ignores today when below goal', () => {
  assert.equal(currentStepStreak([r('2026-01-03', 100), r('2026-01-02', 9000), r('2026-01-01', 9000)], 8000, '2026-01-03'), 2)
})

test('counts today when goal met', () => {
  assert.equal(currentStepStreak([r('2026-01-03', 9000), r('2026-01-02', 9000)], 8000, '2026-01-03'), 2)
})

test('a missing day breaks the streak', () => {
  assert.equal(currentStepStreak([r('2026-01-03', 9000), r('2026-01-01', 9000)], 8000, '2026-01-03'), 1)
})

test('a past day below goal gives 0', () => {
  assert.equal(currentStepStreak([r('2026-01-02', 100)], 8000, '2026-01-03'), 0)
})

test('a missing day breaks the longest streak', () => {
  const rows = [r('2026-01-01', 9000), r('2026-01-02', 9000), r('2026-01-04', 9000), r('2026-01-05', 9000), r('2026-01-06', 9000)]
  assert.equal(longestStepStreak(rows, 8000), 3)
  assert.equal(longestStepStreak([r('2026-01-01', 9000), r('2026-01-03', 9000)], 8000), 1)
})

test('a streak that ended days ago is not current', () => {
  assert.equal(currentStepStreak([r('2026-01-03', 9000), r('2026-01-02', 9000)], 8000, '2026-01-08'), 0)
  assert.equal(currentStepStreak([r('2026-01-07', 9000), r('2026-01-06', 9000)], 8000, '2026-01-08'), 2)
})
