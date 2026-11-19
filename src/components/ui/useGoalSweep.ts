'use client'

import { useEffect, useRef, useState } from 'react'

// A goal is only ever crossed by a log, and a log lands its row with a 1.8s
// wash first. The sweep waits for it, so the meal lands, then the goal lights
// up: one moving gradient at a time.
export const AFTER_LANDING_MS = 1900
export const SWEEP_MS = 1700

// Shared across every hook instance: one log can cross two goals at once
// (calories and protein on Today), and their sweeps must queue, not overlap.
let busyUntil = 0

/** Delay (ms from `now`) before the next sweep may start; reserves its slot. */
export function nextSweepDelay(now: number): number {
  const startAt = Math.max(now + AFTER_LANDING_MS, busyUntil)
  busyUntil = startAt + SWEEP_MS
  return startAt - now
}

/**
 * True for one moment after `reached` flips from false to true during this
 * session, so the number can play the gradient sweep once. Never fires on the
 * first render: opening the app on a finished goal is not a new achievement.
 */
export function useGoalSweep(reached: boolean): boolean {
  const prev = useRef<boolean | null>(null)
  const [sweep, setSweep] = useState(false)

  useEffect(() => {
    const crossed = prev.current === false && reached
    prev.current = reached
    if (!crossed) return
    let end: ReturnType<typeof setTimeout> | undefined
    const start = setTimeout(() => {
      setSweep(true)
      end = setTimeout(() => setSweep(false), SWEEP_MS)
    }, nextSweepDelay(Date.now()))
    return () => { clearTimeout(start); if (end) clearTimeout(end) }
  }, [reached])

  return sweep
}
