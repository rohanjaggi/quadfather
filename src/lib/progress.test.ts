import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateEstimated1RM, findBestSets, snapshotFromSessions } from './progress'

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

const day = (d: number) => new Date(Date.UTC(2026, 10, d))
const at = (d: number, ...sets: [number, number | null][]) => ({
  date: day(d),
  sets: sets.map(([reps, weight_kg]) => ({ reps, weight_kg })),
})
const since = day(1)

test('snapshotFromSessions: first weighted session sets every record, announces none', () => {
  const r = snapshotFromSessions([at(2, [10, null]), at(3, [5, 80])], since)
  assert.deepEqual(r.prs, [null, null])
  assert.deepEqual(r.snapshot, {
    estimated_1rm: 93.3,
    best_set_weight: 80,
    best_set_reps: 5,
    best_weight: 80,
    best_weight_reps: 5,
    total_volume_7d: 400,
    last_improved_at: day(3),
    best_weight_improved_at: day(3),
    sessions_since_improvement: 0,
  })
})

test('snapshotFromSessions: bodyweight-only history has no snapshot', () => {
  assert.equal(snapshotFromSessions([at(2, [10, null], [10, 0])], since).snapshot, null)
  assert.equal(snapshotFromSessions([], since).snapshot, null)
})

test('snapshotFromSessions: heavier set is a weight PR, more reps at it a reps PR', () => {
  const r = snapshotFromSessions([at(2, [5, 80]), at(3, [5, 85]), at(4, [6, 85]), at(5, [6, 85])], since)
  assert.deepEqual(r.prs, [
    null,
    { type: 'weight', value: '85kg × 5' },
    { type: 'reps', value: '6 reps @ 85kg' },
    null,
  ])
  assert.equal(r.snapshot?.best_weight, 85)
  assert.equal(r.snapshot?.best_weight_reps, 6)
  assert.deepEqual(r.snapshot?.best_weight_improved_at, day(4))
  assert.equal(r.snapshot?.sessions_since_improvement, 1)
})

test('snapshotFromSessions: e1RM-only improvement resets the stall clock but is no PR', () => {
  const r = snapshotFromSessions([at(2, [8, 80]), at(3, [10, 77.5])], since)
  assert.deepEqual(r.prs, [null, null])
  assert.equal(r.snapshot?.estimated_1rm, 103.3)
  assert.equal(r.snapshot?.best_set_weight, 77.5)
  assert.equal(r.snapshot?.best_set_reps, 10)
  assert.equal(r.snapshot?.best_weight, 80)
  assert.equal(r.snapshot?.best_weight_reps, 8)
  assert.deepEqual(r.snapshot?.last_improved_at, day(3))
  assert.deepEqual(r.snapshot?.best_weight_improved_at, day(2))
  assert.equal(r.snapshot?.sessions_since_improvement, 0)
})

test('snapshotFromSessions: weight PR at a lower e1RM keeps the e1RM set', () => {
  const r = snapshotFromSessions([at(2, [10, 77.5]), at(3, [5, 80])], since)
  assert.deepEqual(r.prs[1], { type: 'weight', value: '80kg × 5' })
  assert.equal(r.snapshot?.estimated_1rm, 103.3)
  assert.equal(r.snapshot?.best_set_weight, 77.5)
  assert.deepEqual(r.snapshot?.last_improved_at, day(3))
})

test('snapshotFromSessions: stall counts weighted sessions only, volume only since cutoff', () => {
  const r = snapshotFromSessions(
    [at(0, [5, 100]), at(2, [5, 95]), at(3, [12, null]), at(4, [5, 100])],
    since,
  )
  assert.equal(r.snapshot?.sessions_since_improvement, 2)
  assert.deepEqual(r.snapshot?.last_improved_at, day(0))
  assert.equal(r.snapshot?.total_volume_7d, 975)
  assert.deepEqual(r.prs, [null, null, null, null])
})

test('snapshotFromSessions: a backdated session is ranked by date, owns the PR, later sessions stall', () => {
  const s1 = at(2, [5, 100])
  const s2 = at(3, [5, 105])
  const s3 = at(4, [5, 90])
  const inOrder = snapshotFromSessions([s1, s2, s3], since)

  assert.equal(inOrder.snapshot?.sessions_since_improvement, 1)
  assert.deepEqual(inOrder.snapshot?.last_improved_at, day(3))
  assert.deepEqual(inOrder.prs, [null, { type: 'weight', value: '105kg × 5' }, null])
})

test('snapshotFromSessions: a backdated session below a later record reports no PR', () => {
  const r = snapshotFromSessions([at(1, [5, 80]), at(3, [5, 85]), at(10, [5, 90])], since)
  assert.deepEqual(r.prs, [null, null, { type: 'weight', value: '90kg × 5' }])
})
