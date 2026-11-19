import test from 'node:test'
import assert from 'node:assert/strict'
import { errorMessage } from './errors'

const api = (status: number, detail: string) => new Error(`API ${status}: ${JSON.stringify({ detail })}`)
const FALLBACK = 'Friendly fallback.'

// Real server phrasings (src/lib/api-handler.ts, src/app/api/**).
const RAW = [
  'id must be an integer',
  'date must be a YYYY-MM-DD or ISO-8601 date string',
  'date is not a real calendar date',
  'exercises must contain at most 50 entries',
  'template_id does not belong to this user',
  'Provide either amount_liters or bottles',
  'Request body must be a JSON object',
  'Malformed JSON body',
  'Internal error',
  'Food log not found',
]

const HUMAN = [
  'Image must be smaller than 8 MB',
  'Image must be a JPEG, PNG, WebP or GIF',
  'An image file is required',
  'A saved food with this name already exists',
  'No API key configured. Set one up in Settings.',
  'Set a bottle size in Settings before logging bottles',
  "Couldn't read a run from that image — try a clearer screenshot",
  'Invalid API key',
]

test('raw validation and plumbing detail falls back to the friendly message', () => {
  for (const d of RAW) assert.equal(errorMessage(api(422, d), FALLBACK), FALLBACK, d)
})

test('messages written for people still come through', () => {
  for (const d of HUMAN) assert.equal(errorMessage(api(422, d), FALLBACK), d, d)
})
