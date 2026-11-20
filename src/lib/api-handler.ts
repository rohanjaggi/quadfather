import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type User } from '@prisma/client'
import {
  getAuthenticatedUser,
  getAuthenticatedUserFlexible,
} from '@/lib/auth'
import { ACCEPTED_IMAGE_TYPES } from '@/lib/image'
import {
  ApiError,
  badRequest,
  conflict,
  notFound,
  unprocessable,
  timingSafeEqualStr,
} from '@/lib/api-error'

export { ApiError, badRequest, notFound, conflict, unprocessable, timingSafeEqualStr }

/** Map any thrown value to a JSON response. */
function handleRouteError(e: unknown): NextResponse {
  // Next.js control-flow errors (build-time dynamic probes, notFound/redirect) must propagate,
  // or a route could be statically cached with a 500.
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

  console.error('Unhandled route error:', e)
  return NextResponse.json({ detail: 'Internal error' }, { status: 500 })
}

type RouteContext = { params: Record<string, string> }

type UserHandler<C> = (
  request: NextRequest,
  user: User,
  context: C,
) => Promise<Response> | Response

function wrap<A extends unknown[]>(
  run: (request: NextRequest, ...rest: A) => Promise<Response> | Response,
) {
  return async (request: NextRequest, ...rest: A): Promise<Response> => {
    try {
      return await run(request, ...rest)
    } catch (e) {
      return handleRouteError(e)
    }
  }
}

/**
 * Wrap a handler with Telegram-initData auth + uniform error mapping.
 * `withUser<{ params: { id: string } }>(async (req, user, { params }) => ...)` types route params.
 */
export function withUser<C = RouteContext>(handler: UserHandler<C>) {
  return wrap(async (request: NextRequest, context: C) =>
    handler(request, await getAuthenticatedUser(request), context),
  )
}

/** Like `withUser`, but also accepts the Shortcut bearer token. */
export function withFlexibleUser<C = RouteContext>(handler: UserHandler<C>) {
  return wrap(async (request: NextRequest, context: C) =>
    handler(request, await getAuthenticatedUserFlexible(request), context),
  )
}

/** Wrap an unauthenticated handler with uniform error mapping only. */
export function withErrorHandling<C = RouteContext>(
  handler: (request: NextRequest, context: C) => Promise<Response> | Response,
) {
  return wrap(handler)
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

/** An uploaded image as the vision models take it. */
export interface ImageInput {
  base64: string
  mimeType: string
}

/** Under Vercel's 4.5 MB request-body limit, so an oversized photo gets this 413 rather than the platform's. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * Read the multipart `image` field. Unsupported formats (HEIC, BMP, TIFF) are
 * rejected here since providers fail on them opaquely. `form` is returned for other fields.
 */
export async function readImageUpload(
  request: Request,
): Promise<{ image: ImageInput; form: FormData }> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw badRequest('Malformed multipart form data')
  }

  const file = form.get('image')
  if (!file || typeof file === 'string') {
    throw unprocessable('An image file is required')
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw unprocessable('Image must be a JPEG, PNG, WebP or GIF')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError(413, 'Image must be smaller than 4 MB')
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  return { image: { base64, mimeType: file.type }, form }
}

interface Range {
  min?: number
  max?: number
}

function checkRange(n: number, name: string, { min, max }: Range): number {
  if (min !== undefined && n < min) throw unprocessable(`${name} must be ≥ ${min}`)
  if (max !== undefined && n > max) throw unprocessable(`${name} must be ≤ ${max}`)
  return n
}

/** Numbers and non-blank numeric strings; NaN for anything else. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
}

/** Integer from a param/query/body value; 422 otherwise. Canonical decimals only: `Number()` takes '1e3' and '0x10'. */
export function requireInt(value: unknown, name: string, opts: Range = {}): number {
  if (typeof value === 'string' && !/^-?\d+$/.test(value.trim()))
    throw unprocessable(`${name} must be an integer`)
  const n = toNumber(value)
  if (!Number.isInteger(n)) throw unprocessable(`${name} must be an integer`)
  // Beyond the safe-integer range a canonical decimal would still reach Prisma as P2033.
  if (!Number.isSafeInteger(n)) throw unprocessable(`${name} is out of range`)
  return checkRange(n, name, opts)
}

/** `undefined`/`null` → `undefined`; otherwise validated integer. */
export function optionalInt(
  value: unknown,
  name: string,
  opts: Range = {},
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requireInt(value, name, opts)
}

/** Finite number (accepts numeric strings); 422 otherwise. */
export function requireNumber(value: unknown, name: string, opts: Range = {}): number {
  const n = toNumber(value)
  if (!Number.isFinite(n)) throw unprocessable(`${name} must be a number`)
  return checkRange(n, name, opts)
}

export function optionalNumber(
  value: unknown,
  name: string,
  opts: Range = {},
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requireNumber(value, name, opts)
}

/**
 * Read a key that maps to a *nullable* column. Absent → `undefined` (leave the
 * column alone); `null` or `''` → `null` (clear it); anything else → `parse(value)`.
 */
export function nullable<T>(
  body: Record<string, unknown>,
  key: string,
  parse: (value: unknown) => T,
): T | null | undefined {
  if (!(key in body)) return undefined
  const value = body[key]
  return value === null || value === '' ? null : parse(value)
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

/** Read a `String?` column holding a JSON string array; legacy bare-string or invalid JSON degrades to `[]`. */
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
const AI_PROVIDER_ERROR_DETAIL =
  'AI provider error — check your API key in Settings'

/**
 * Run an AI provider call, mapping any failure to a fixed 502: SDK errors carry the
 * API key and prompt fragments in `.message`, so they are logged, never returned.
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

  // `new Date('2026-02-31')` silently rolls over; round-trip the UTC fields to catch it.
  // Bare `YYYY-MM-DD` only: a full ISO datetime may carry an offset.
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
