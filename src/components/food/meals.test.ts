import test from 'node:test'
import assert from 'node:assert/strict'
import { distinctRecent, groupByPartOfDay, macroLine, partOfDay } from './meals'
import type { FoodLog } from '@/types/api'

// Built from local wall-clock times so the test holds in any device timezone.
const at = (h: number, m = 0) => new Date(2026, 10, 20, h, m).toISOString()

test('partOfDay boundaries: <11 morning, 11–15 midday, 15–18 afternoon, ≥18 evening', () => {
  assert.equal(partOfDay(at(10, 59)), 'Morning')
  assert.equal(partOfDay(at(11)), 'Midday')
  assert.equal(partOfDay(at(14, 59)), 'Midday')
  assert.equal(partOfDay(at(15)), 'Afternoon')
  assert.equal(partOfDay(at(17, 59)), 'Afternoon')
  assert.equal(partOfDay(at(18)), 'Evening')
  assert.equal(partOfDay(at(0, 5)), 'Morning')
})

test('groupByPartOfDay orders by time, drops empty parts, sums kcal', () => {
  const log = (id: number, h: number, calories: number) =>
    ({ id, food_name: `m${id}`, servings: 1, calories, protein: 0, carbohydrates: 0, fats: 0, fiber: 0, source: 'manual', logged_at: at(h) }) as FoodLog
  const groups = groupByPartOfDay([log(3, 19, 600), log(1, 9, 300), log(2, 8, 200)])
  assert.deepEqual(groups.map(g => g.label), ['Morning', 'Evening'])
  assert.deepEqual(groups[0].logs.map(l => l.id), [2, 1])
  assert.equal(groups[0].kcal, 500)
})

test('macroLine reads in plain words', () => {
  assert.equal(macroLine({ protein: 32.4, carbohydrates: 80, fats: 18 }), '32 g protein · 80 g carbs · 18 g fat')
  assert.equal(macroLine({ protein: 1, carbohydrates: 2, fats: 3, fiber: 4 }, true), '1 g protein · 2 g carbs · 3 g fat · 4 g fibre')
})

test('distinctRecent keeps the newest of each name, ignoring case and spaces, up to the limit', () => {
  const logs = [
    { id: 5, food_name: 'Kopi ' },
    { id: 4, food_name: 'Chicken rice' },
    { id: 3, food_name: 'kopi' },
    { id: 2, food_name: 'Toast' },
    { id: 1, food_name: 'CHICKEN RICE' },
  ]
  assert.deepEqual(distinctRecent(logs).map(l => l.id), [5, 4, 2])
  assert.deepEqual(distinctRecent(logs, 2).map(l => l.id), [5, 4])
})
