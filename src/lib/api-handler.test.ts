import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, nullable, requireInt, requireNumber, parseDateParam, parseJsonStringArray, readImageUpload } from './api-handler'

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

function upload(image?: File | string): Request {
  const form = new FormData()
  if (image !== undefined) form.append('image', image)
  return new Request('http://test/', { method: 'POST', body: form })
}

test('readImageUpload returns the accepted image as base64', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
  const { image } = await readImageUpload(upload(file))
  assert.deepEqual(image, { base64: 'AQID', mimeType: 'image/png' })
})

test('readImageUpload rejects missing, unsupported, oversized and non-multipart uploads', async () => {
  const status = (n: number) => (e: unknown) => e instanceof ApiError && e.status === n
  await assert.rejects(readImageUpload(upload()), status(422))
  await assert.rejects(readImageUpload(upload('not a file')), status(422))
  await assert.rejects(readImageUpload(upload(new File(['x'], 'a.heic', { type: 'image/heic' }))), status(422))
  const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })
  await assert.rejects(readImageUpload(upload(big)), status(413))
  await assert.rejects(readImageUpload(new Request('http://test/', { method: 'POST', body: 'nope' })), status(400))
})

test('requireNumber shares the min/max check with requireInt', () => {
  assert.equal(requireNumber('1.5', 'w', { min: 1, max: 2 }), 1.5)
  assert.throws(() => requireNumber(0.5, 'w', { min: 1 }), /w must be ≥ 1/)
  assert.throws(() => requireNumber(3, 'w', { max: 2 }), /w must be ≤ 2/)
  assert.throws(() => requireNumber('x', 'w'), /w must be a number/)
})

test('nullable distinguishes absent, cleared and supplied', () => {
  const parse = (v: unknown) => String(v).toUpperCase()
  assert.equal(nullable({}, 'k', parse), undefined)
  assert.equal(nullable({ k: null }, 'k', parse), null)
  assert.equal(nullable({ k: '' }, 'k', parse), null)
  assert.equal(nullable({ k: 'a' }, 'k', parse), 'A')
})
