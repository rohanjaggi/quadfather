/**
 * Turning thrown values into text a user should actually see.
 *
 * `apiFetch` throws `new Error('API <status>: <body>')`, so the raw message
 * carries both the HTTP status and the server's JSON body. These helpers pull
 * those apart — never render `err.message` directly.
 */

/** Extracts the HTTP status from an `API <status>: …` error, if there is one. */
export function errorStatus(err: unknown): number | null {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const match = /^API (\d{3}):/.exec(raw)
  return match ? Number(match[1]) : null
}

/**
 * Turns anything thrown by `apiFetch` (which throws `API <status>: <body>`)
 * or by `fetch` itself into a message worth showing a user, preferring the
 * server's `detail` field when the body is JSON.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  // `apiFetch` caps every request with `AbortSignal.timeout`, which rejects
  // with a `DOMException` — not an `Error` in every engine, and its `message`
  // ("signal timed out") is useless to a user. Match on `name` first, before
  // anything tries to read `.message`.
  const name = typeof err === 'object' && err !== null && 'name' in err
    ? String((err as { name?: unknown }).name)
    : ''
  if (name === 'TimeoutError' || name === 'AbortError') {
    return 'Request timed out — check your connection and try again.'
  }

  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (!raw) return fallback
  if (/signal timed out|the operation was aborted/i.test(raw)) {
    return 'Request timed out — check your connection and try again.'
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return 'Network error — check your connection'
  }
  const body = raw.replace(/^API \d+:\s*/, '').trim()
  try {
    const parsed = JSON.parse(body) as { detail?: unknown }
    const detail = parsed?.detail
    if (typeof detail === 'string' && detail.trim()) return detail.trim()
  } catch {
    // body was not JSON — fall through to the raw text
  }
  if (!body || body.startsWith('<')) return fallback
  return body.length > 160 ? `${body.slice(0, 157)}…` : body
}
