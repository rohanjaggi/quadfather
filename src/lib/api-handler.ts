import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type User } from '@prisma/client'
import { timingSafeEqual } from 'crypto'
import {
  getAuthenticatedUser,
  getAuthenticatedUserFlexible,
} from '@/lib/auth'

/**
 * Shared plumbing for API route handlers.
 *
 *  - `ApiError` — throw from anywhere inside a handler to produce a clean
 *    `{ detail }` response with the given status (400/401/404/409/422/…).
 *  - `withUser(handler)` — authenticates via Telegram initData, runs the
 *    handler, and maps every error (ApiError, auth failures, Prisma known
 *    errors, anything else) to a response. Unknown errors are logged server
 *    side and returned as a generic 500 — never echo raw Prisma/provider text.
 *  - `withFlexibleUser(handler)` — same, but also accepts the Shortcut bearer
 *    token (`Authorization: Bearer …`).
 *  - `parseJsonBody(request)` — 400 on malformed JSON instead of 500.
 *  - `requireInt`, `optionalInt`, `optionalNumber`, `requireString`,
 *    `optionalBoolean`, `optionalEnum`, `parseDateParam` — small validators
 *    that throw ApiError(422).
 *  - `callAIProvider(label, fn)` — runs an AI call and turns any provider
 *    failure into a fixed 502 so key/prompt text never reaches the client.
 *  - `parseJsonStringArray(raw)` — tolerant reader for JSON-array columns.
 *  - `timingSafeEqualStr(a, b)` — constant-time secret comparison.
 */

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg)
export const unauthorized = (msg = 'Unauthorized') => new ApiError(401, msg)
export const forbidden = (msg = 'Forbidden') => new ApiError(403, msg)
export const notFound = (msg = 'Not found') => new ApiError(404, msg)
export const conflict = (msg: string) => new ApiError(409, msg)
export const unprocessable = (msg: string) => new ApiError(422, msg)

/** Messages thrown by `src/lib/auth.ts` that mean "not authenticated". */
const AUTH_ERROR_PATTERNS = [
  'initData',
  'hash',
  'Missing or invalid Authorization header',
  'Invalid access token',
  'Invalid bot token',
]

/** Map any thrown value to a JSON response. Safe to call from any route. */
export function handleRouteError(e: unknown): NextResponse {
  // Next.js control-flow errors (dynamic-usage probes at build time, notFound/
  // redirect bail-outs) must propagate to the framework — swallowing the
  // build-time probe would let a route be statically cached with a 500.
  if (
    typeof e === 'object' &&
    e !== null &&
    'digest' in e &&
    typeof (e as { digest?: unknown }).digest === 'string' &&
    ((e as { digest: string }).digest === 'DYNAMIC_SERVER_USAGE' ||
      (e as { digest: string }).digest.startsWith('NEXT_'))
  ) {
    throw e
  }

  if (e instanceof ApiError) {
    return NextResponse.json({ detail: e.message }, { status: e.status })
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      return NextResponse.json(
        { detail: 'A record with these values already exists' },
        { status: 409 },
      )
    }
    if (e.code === 'P2025') {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    if (e.code === 'P2003') {
      return NextResponse.json(
        { detail: 'Referenced record does not exist' },
        { status: 422 },
      )
    }
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    // Wrong type/shape reaching Prisma (e.g. a string where an Int is
    // expected). The caller sent something invalid; don't expose internals.
    console.error('Prisma validation error:', e.message)
    return NextResponse.json({ detail: 'Invalid request payload' }, { status: 422 })
  }

  const message = e instanceof Error ? e.message : String(e)

  if (message === 'User not found') {
    return NextResponse.json({ detail: message }, { status: 404 })
  }
  if (AUTH_ERROR_PATTERNS.some(p => message.includes(p))) {
    return NextResponse.json({ detail: message }, { status: 401 })
  }
  if (message.includes('No API key')) {
    return NextResponse.json({ detail: message }, { status: 400 })
  }

  console.error('Unhandled route error:', e)
  return NextResponse.json({ detail: 'Internal error' }, { status: 500 })
}

type RouteContext = { params: Record<string, string> }

type UserHandler<C> = (
  request: NextRequest,
  user: User,
  context: C,
) => Promise<Response> | Response

/**
 * Wrap a handler with Telegram-initData auth + uniform error mapping.
 *
 * ```ts
 * export const GET = withUser(async (request, user) => { ... })
 * export const DELETE = withUser<{ params: { id: string } }>(async (req, user, { params }) => { ... })
 * ```
 */
export function withUser<C = RouteContext>(handler: UserHandler<C>) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    try {
      const user = await getAuthenticatedUser(request)
      return await handler(request, user, context)
    } catch (e) {
      return handleRouteError(e)
    }
  }
}

/** Like `withUser`, but also accepts the Shortcut bearer token. */
export function withFlexibleUser<C = RouteContext>(handler: UserHandler<C>) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    try {
      const user = await getAuthenticatedUserFlexible(request)
      return await handler(request, user, context)
    } catch (e) {
      return handleRouteError(e)
    }
  }
}

/** Wrap an unauthenticated handler with uniform error mapping only. */
export function withErrorHandling<C = RouteContext>(
  handler: (request: NextRequest, context: C) => Promise<Response> | Response,
) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    try {
      return await handler(request, context)
    } catch (e) {
      return handleRouteError(e)
    }
  }
}

/** Parse a JSON body; 400 on malformed JSON, 422 if it isn't an object. */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: NextRequest,
): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw badRequest('Malformed JSON body')
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw unprocessable('Request body must be a JSON object')
  }
  return body as T
}

/** Integer from a route param / query string / body value; 422 otherwise. */
export function requireInt(
  value: unknown,
  name: string,
  opts: { min?: number; max?: number } = {},
): number {
  // `Number()` accepts far more than an integer literal: `'1e3'` → 1000,
  // `'0x10'` → 16, `'  12  '` → 12 — and all three pass `Number.isInteger`.
  // The exponent form is the dangerous one: `?id=1e20` used to parse cleanly
  // and reach Prisma as a value nowhere near an `Int` column, which surfaces
  // as P2033 and a generic 500 instead of a 422. Require a canonical decimal
  // integer instead.
  if (typeof value === 'string' && !/^-?\d+$/.test(value.trim()))
    throw unprocessable(`${name} must be an integer`)
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN
  if (!Number.isInteger(n)) throw unprocessable(`${name} must be an integer`)
  // A canonical but huge decimal (`?id=99999999999999999999`) parses to a
  // number well outside Postgres `Int` range and would reach Prisma as P2033
  // → generic 500. Reject anything beyond the safe-integer range here; callers
  // that need a tighter bound (e.g. an `Int` column) still pass an explicit max.
  if (!Number.isSafeInteger(n)) throw unprocessable(`${name} is out of range`)
  if (opts.min !== undefined && n < opts.min)
    throw unprocessable(`${name} must be ≥ ${opts.min}`)
  if (opts.max !== undefined && n > opts.max)
    throw unprocessable(`${name} must be ≤ ${opts.max}`)
  return n
}

/** `undefined`/`null` → `undefined`; otherwise validated integer. */
export function optionalInt(
  value: unknown,
  name: string,
  opts: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requireInt(value, name, opts)
}

/** Finite number (accepts numeric strings); 422 otherwise. */
export function requireNumber(
  value: unknown,
  name: string,
  opts: { min?: number; max?: number } = {},
): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN
  if (!Number.isFinite(n)) throw unprocessable(`${name} must be a number`)
  if (opts.min !== undefined && n < opts.min)
    throw unprocessable(`${name} must be ≥ ${opts.min}`)
  if (opts.max !== undefined && n > opts.max)
    throw unprocessable(`${name} must be ≤ ${opts.max}`)
  return n
}

export function optionalNumber(
  value: unknown,
  name: string,
  opts: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requireNumber(value, name, opts)
}

/** Non-empty trimmed string with an optional max length; 422 otherwise. */
export function requireString(
  value: unknown,
  name: string,
  opts: { maxLength?: number } = {},
): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw unprocessable(`${name} is required`)
  const s = value.trim()
  if (opts.maxLength !== undefined && s.length > opts.maxLength)
    throw unprocessable(`${name} must be at most ${opts.maxLength} characters`)
  return s
}

export function optionalString(
  value: unknown,
  name: string,
  opts: { maxLength?: number } = {},
): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw unprocessable(`${name} must be a string`)
  if (opts.maxLength !== undefined && value.length > opts.maxLength)
    throw unprocessable(`${name} must be at most ${opts.maxLength} characters`)
  return value
}

/** `undefined`/`null` → `undefined`; otherwise a real boolean (no coercion). */
export function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') throw unprocessable(`${name} must be true or false`)
  return value
}

/** `undefined`/`null`/`''` → `undefined`; otherwise a member of `allowed`; 422 otherwise. */
export function optionalEnum<T extends string>(
  value: unknown,
  name: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value))
    throw unprocessable(`${name} must be one of: ${allowed.join(', ')}`)
  return value as T
}

/**
 * Read a `String?` column that stores a JSON array of strings.
 *
 * Legacy rows may hold a bare JSON string (`"\"vegan\""` — what the old
 * unvalidated goals PUT wrote) or invalid JSON; both degrade to `[]` rather
 * than throwing a 500 out of a read path.
 */
export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

/** The only thing a client is ever told about an upstream AI failure. */
export const AI_PROVIDER_ERROR_DETAIL =
  'AI provider error — check your API key in Settings'

/**
 * Run a call to an AI provider, mapping any failure to a fixed 502.
 *
 * Provider SDK errors put the API key, model id and prompt fragments into
 * `.message` (e.g. "Incorrect API key provided: sk-…"), so the original is
 * logged server-side and never returned. `ApiError`s thrown by our own code
 * inside `fn` pass through untouched.
 */
export async function callAIProvider<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError) throw e
    console.error(`AI provider error (${label}):`, e)
    throw new ApiError(502, AI_PROVIDER_ERROR_DETAIL)
  }
}

const DATE_ONLY_PARAM = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Parse a `YYYY-MM-DD` (or full ISO) date param into a valid Date; 422 if
 * unparseable. Returns `undefined` when the param is absent.
 */
export function parseDateParam(value: string | null | undefined, name = 'date'): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw unprocessable(`${name} must be a valid date`)

  // `new Date('2026-02-31')` is *not* an Invalid Date — it silently rolls over
  // to Mar 3, so a typo'd day filed logs under, or queried, the wrong date.
  // Round-trip the parsed UTC fields against the input to catch that.
  //
  // Only for the bare `YYYY-MM-DD` form: a full ISO datetime may carry an
  // offset (`2026-08-20T01:00:00+08:00`), where the UTC calendar day
  // legitimately differs from the one written in the string.
  const dateOnly = DATE_ONLY_PARAM.exec(value)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    if (
      d.getUTCFullYear() !== Number(year) ||
      d.getUTCMonth() !== Number(month) - 1 ||
      d.getUTCDate() !== Number(day)
    ) {
      throw unprocessable(`${name} is not a real calendar date`)
    }
  }

  return d
}

/** Constant-time string comparison for shared secrets (length mismatch → false). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length || ab.length === 0) return false
  return timingSafeEqual(ab, bb)
}
