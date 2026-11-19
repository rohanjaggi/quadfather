'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animates a displayed number to `target` whenever the target changes after
 * the first render (so logging a meal visibly counts "kcal left" down).
 * The first render shows the real value immediately; reduced motion skips
 * the animation.
 */
export function useCountTo(target: number, ms = 700): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; from.current = target; setShown(target); return }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    if (reduce || start === target) { from.current = target; setShown(target); return }

    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = start + (target - start) * eased
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])

  return shown
}
