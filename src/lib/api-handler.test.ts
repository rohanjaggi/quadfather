import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireInt, parseDateParam, parseJsonStringArray } from './api-handler'

test('requireInt accepts canonical integers', () => {
  assert.equal(requireInt('42', 'id'), 42)
  assert.equal(requireInt(7, 'id'), 7)
})

test('requireInt rejects non-canonical and huge values', () => {
  for (const v of ['1e3', '0x10', '1.5', '99999999999999999999', '', 'abc']) {
    assert.throws(() => requireInt(v, 'id'), /id must be an integer|out of range/, v)
  }
})

test('requireInt enforces min/max', () => {
  assert.throws(() => requireInt('0', 'id', { min: 1 }), /≥ 1/)
  assert.throws(() => requireInt('9', 'id', { max: 5 }), /≤ 5/)
})

test('parseDateParam', () => {
  assert.throws(() => parseDateParam('2026-02-31'), /not a real calendar date/)
  assert.throws(() => parseDateParam('nope'), /valid date/)
  assert.equal(parseDateParam('2026-02-28')?.toISOString(), '2026-02-28T00:00:00.000Z')
  assert.equal(
    parseDateParam('2026-08-20T01:00:00+08:00')?.toISOString(),
    '2026-08-19T17:00:00.000Z',
  )
  assert.equal(parseDateParam(null), undefined)
  assert.equal(parseDateParam(''), undefined)
})

test('parseJsonStringArray', () => {
  assert.deepEqual(parseJsonStringArray('["a","b"]'), ['a', 'b'])
  assert.deepEqual(parseJsonStringArray('"vegan"'), [])
  assert.deepEqual(parseJsonStringArray('{not json'), [])
  assert.deepEqual(parseJsonStringArray('["a",1,null,"b"]'), ['a', 'b'])
  assert.deepEqual(parseJsonStringArray(null), [])
})
