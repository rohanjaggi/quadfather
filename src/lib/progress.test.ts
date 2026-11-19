import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateEstimated1RM, findBestSets } from './progress'

test('calculateEstimated1RM (Epley, 1 decimal)', () => {
  assert.equal(calculateEstimated1RM(100, 1), 103.3)
  assert.equal(calculateEstimated1RM(80, 8), 101.3)
  assert.equal(calculateEstimated1RM(100, 0), 100)
})

test('findBestSets: heaviest weight wins, ties go to more reps', () => {
  const r = findBestSets([
    { reps: 5, weight_kg: 80 },
    { reps: 10, weight_kg: 77.5 },
    { reps: 8, weight_kg: 80 },
    { reps: 6, weight_kg: 80 },
  ])
  assert.equal(r.bestWeight, 80)
  assert.equal(r.bestWeightReps, 8)
})

test('findBestSets: equal e1RM keeps the first set', () => {
  const a = { reps: 10, weight_kg: 90 }
  const b = { reps: 6, weight_kg: 100 }
  assert.equal(calculateEstimated1RM(90, 10), calculateEstimated1RM(100, 6))
  assert.equal(findBestSets([a, b]).e1rmSet, a)
  assert.equal(findBestSets([b, a]).e1rmSet, b)
})

test('findBestSets: best e1RM can differ from heaviest set', () => {
  const heavy = { reps: 8, weight_kg: 80 }
  const volume = { reps: 10, weight_kg: 77.5 }
  const r = findBestSets([heavy, volume])
  assert.equal(r.e1rmSet, volume)
  assert.equal(r.best1RM, 103.3)
  assert.equal(r.bestWeight, 80)
})

test('findBestSets ignores unloaded sets and honours seed', () => {
  const empty = findBestSets([{ reps: 10, weight_kg: null }, { reps: 10, weight_kg: 0 }])
  assert.deepEqual(empty, { best1RM: 0, e1rmSet: null, bestWeight: 0, bestWeightReps: 0 })
  const seeded = findBestSets([{ reps: 1, weight_kg: 50 }], { ...empty, best1RM: 200, bestWeight: 100, bestWeightReps: 1 })
  assert.equal(seeded.best1RM, 200)
  assert.equal(seeded.bestWeight, 100)
})
