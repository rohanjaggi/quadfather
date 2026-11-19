import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setsSummary, topSet, weekStartKey, sessionVolume } from './format'
import { prEstimated1RM } from './pr-display'
import type { WorkoutPR } from '@/lib/api'

test('weekStartKey lands on Monday', () => {
  assert.equal(weekStartKey('2026-11-20'), '2026-11-16') // Friday
  assert.equal(weekStartKey('2026-11-16'), '2026-11-16') // Monday
  assert.equal(weekStartKey('2026-11-22'), '2026-11-16') // Sunday
})

test('setsSummary collapses matching sets and names the top set otherwise', () => {
  assert.equal(setsSummary([{ reps: 8, weight_kg: 60 }, { reps: 8, weight_kg: 60 }, { reps: 8, weight_kg: 60 }]), '3 × 8 · 60 kg')
  assert.equal(setsSummary([{ reps: 12, weight_kg: null }, { reps: 12, weight_kg: null }]), '2 × 12')
  assert.equal(setsSummary([{ reps: 8, weight_kg: 60 }, { reps: 5, weight_kg: 62.5 }]), '2 sets · top 62.5 kg × 5')
  assert.equal(setsSummary([]), 'No sets')
})

test('topSet prefers weight, then reps', () => {
  assert.deepEqual(topSet([{ reps: 10, weight_kg: 60 }, { reps: 6, weight_kg: 60 }, { reps: 3, weight_kg: 50 }]), { reps: 10, weight_kg: 60 })
  assert.equal(topSet([]), null)
})

test('sessionVolume ignores bodyweight sets', () => {
  assert.equal(sessionVolume({ exercises: [
    { exercise_name: 'Bench', order: 1, sets: [{ reps: 5, weight_kg: 100 }] },
    { exercise_name: 'Pull-up', order: 2, sets: [{ reps: 10, weight_kg: null }] },
  ] }), 500)
})

test('prEstimated1RM parses the route value with Epley', () => {
  const pr = (value: string): WorkoutPR => ({ exercise_name: 'Bench', type: 'weight', value, volume: 0, date: null })
  assert.equal(prEstimated1RM(pr('100kg × 5')), 116.7)
  assert.equal(prEstimated1RM(pr('62.5kg × 8')), 79.2)
  assert.equal(prEstimated1RM(pr('0kg × 5')), null)
  assert.equal(prEstimated1RM(pr('n/a')), null)
})
