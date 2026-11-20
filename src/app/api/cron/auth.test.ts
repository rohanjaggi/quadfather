import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

// Should the guard ever regress, the user query must hit a dead address, never a real database.
process.env.DATABASE_URL = 'postgresql://nobody@127.0.0.1:1/none'
process.env.CRON_SECRET = 'test-cron-secret'

async function load() {
  const mod = await import('./auth')
  // Prisma loads `.env` on import, which may carry a real token; this test needs it unset.
  delete process.env.BOTFATHER_TOKEN
  return mod.forEachCronUser
}

const cronRequest = (auth: string) =>
  new NextRequest('http://test/api/cron/x', { headers: { authorization: auth } })

test('forEachCronUser refuses to run without a bot token, before any user work', async (t) => {
  const forEachCronUser = await load()
  const logged = t.mock.method(console, 'error', () => {})
  let calls = 0
  const res = await forEachCronUser(cronRequest('Bearer test-cron-secret'), 'daily_coach', 'Test', async () => {
    calls++
    return true
  })
  assert.equal(res.status, 500)
  assert.deepEqual(await res.json(), { detail: 'Server misconfigured' })
  assert.equal(calls, 0)
  assert.equal(logged.mock.callCount(), 1)
})

test('forEachCronUser still answers 401 to a bad secret first', async () => {
  const forEachCronUser = await load()
  const res = await forEachCronUser(cronRequest('Bearer wrong'), 'daily_coach', 'Test', async () => true)
  assert.equal(res.status, 401)
})
