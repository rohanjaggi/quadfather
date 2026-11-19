import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, dayKey, dayRange, daysAgoStart } from './day'

test('dayKey flips at Singapore midnight (16:00Z)', () => {
  assert.equal(dayKey(new Date('2026-11-19T15:59:59.999Z')), '2026-11-19')
  assert.equal(dayKey(new Date('2026-11-19T16:00:00.000Z')), '2026-11-20')
  assert.equal(dayKey(new Date('2026-12-31T16:00:00.000Z')), '2027-01-01')
})

test('dayRange is [00:00 SGT, next 00:00 SGT)', () => {
  const { start, end } = dayRange('2026-11-20')
  assert.equal(start.toISOString(), '2026-11-19T16:00:00.000Z')
  assert.equal(end.toISOString(), '2026-11-20T16:00:00.000Z')
  assert.equal(dayKey(start), '2026-11-20')
  assert.equal(dayKey(new Date(end.getTime() - 1)), '2026-11-20')
  assert.equal(dayKey(end), '2026-11-21')
})

test('addDays crosses month and leap-day boundaries', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2026-11-20', 0), '2026-11-20')
})

test('daysAgoStart(0) is the start of today', () => {
  const start = daysAgoStart(0)
  assert.equal(start.getTime(), dayRange().start.getTime())
  assert.ok(start.getTime() <= Date.now() && Date.now() < dayRange().end.getTime())
  assert.equal(dayKey(daysAgoStart(1)), addDays(dayKey(), -1))
})
