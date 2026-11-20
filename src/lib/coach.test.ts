import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCloseTheDay, type CloseTheDayInput } from './coach'

const day = (over: Partial<CloseTheDayInput> = {}): CloseTheDayInput => ({
  kcal: 1840.4,
  kcalBudget: 2250.2,
  protein: 96.3,
  proteinGoal: 120,
  waterLiters: 2.14,
  waterGoal: 3,
  steps: 8420,
  stepGoal: 10000,
  meals: 3,
  sessions: [],
  ...over,
})

test('close the day: under budget says how much is left', () => {
  const { html, hasLogs } = buildCloseTheDay(day({ sessions: ['Push day', 'Run'] }))
  assert.equal(hasLogs, true)
  assert.match(html, /Eaten: 1,840 of 2,250 kcal, 410 left/)
  assert.match(html, /Protein: 96 of 120 g/)
  assert.match(html, /Water: 2\.1 of 3 L/)
  assert.match(html, /Steps: 8,420 of 10,000/)
  assert.match(html, /Trained: Push day, Run/)
})

test('close the day: over budget says by how much, and escapes session names', () => {
  const { html } = buildCloseTheDay(day({ kcal: 2400, kcalBudget: 2250, steps: null, sessions: ['Legs & <core>'] }))
  assert.match(html, /2,400 of 2,250 kcal, 150 over/)
  assert.doesNotMatch(html, /Steps/)
  assert.match(html, /Trained: Legs &amp; &lt;core&gt;/)
})

test('close the day: nothing logged is the short version', () => {
  // Synced steps alone don't count as a log.
  const { html, hasLogs } = buildCloseTheDay(day({ kcal: 0, protein: 0, waterLiters: 0, meals: 0, steps: 5000 }))
  assert.equal(hasLogs, false)
  assert.equal(html, '\u{1F319} Nothing logged today. Anything to add?')
})
