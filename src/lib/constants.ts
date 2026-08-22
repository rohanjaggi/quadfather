/**
 * Client-safe shared constants (no server imports here — this file is imported
 * by both API routes and 'use client' components).
 */

/**
 * Exercise calories are credited to the daily budget at 50% because trackers
 * and formulas systematically over-report burn. Used by `src/lib/budget.ts`
 * (server) and by UI that explains the credit (client).
 */
export const EXERCISE_DAMPENING = 0.5

/** Default bodyweight used when the user hasn't entered one. */
export const DEFAULT_BODYWEIGHT_KG = 70
