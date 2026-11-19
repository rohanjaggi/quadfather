import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

const TOKEN = 'test-bot-token'
process.env.BOTFATHER_TOKEN = TOKEN
process.env.SKIP_TELEGRAM_AUTH = 'false'

function sign(fields: Record<string, string>, token = TOKEN): string {
  const check = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = crypto.createHmac('sha256', secret).update(check).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

const user = { id: 42, username: 'rj', first_name: 'R' }
const fresh = () => ({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) })

async function load() {
  return (await import('./auth')).verifyTelegramAuth
}

test('valid initData returns the user', async () => {
  const verify = await load()
  assert.deepEqual(verify(sign(fresh())), user)
})

test('tampered hash fails', async () => {
  const verify = await load()
  const good = sign(fresh())
  const bad = good.replace(/hash=[0-9a-f]/, m => m.slice(0, -1) + (m.endsWith('0') ? '1' : '0'))
  assert.throws(() => verify(bad), /Invalid initData signature/)
})

test('mismatched-length hash throws a plain error', async () => {
  const verify = await load()
  const params = new URLSearchParams(sign(fresh()))
  params.set('hash', 'abc')
  assert.throws(() => verify(params.toString()), /Invalid initData signature/)
})

test('missing hash fails', async () => {
  const verify = await load()
  assert.throws(() => verify(new URLSearchParams(fresh()).toString()), /Missing hash/)
})

test('auth_date older than 24h fails', async () => {
  const verify = await load()
  const old = String(Math.floor(Date.now() / 1000) - 86_400 - 60)
  assert.throws(() => verify(sign({ ...fresh(), auth_date: old })), /expired/)
})
