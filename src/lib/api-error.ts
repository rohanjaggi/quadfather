import { timingSafeEqual } from 'crypto'

/** Throw from anywhere inside a handler for a `{ detail }` response with this status. */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg)
export const notFound = (msg = 'Not found') => new ApiError(404, msg)
export const conflict = (msg: string) => new ApiError(409, msg)
export const unprocessable = (msg: string) => new ApiError(422, msg)

/** Constant-time string comparison for shared secrets (length mismatch → false). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length || ab.length === 0) return false
  return timingSafeEqual(ab, bb)
}
