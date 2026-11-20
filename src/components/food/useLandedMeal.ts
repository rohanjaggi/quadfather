'use client'

import { useEffect, useRef, useState } from 'react'
import type { FoodLog } from '@/types/api'

/**
 * The id of a meal that just appeared in today's list, for one `.row-landed`
 * moment. Ids present on mount count as seen, so only a row that arrives while
 * the page is open lands. Seen ids are never forgotten, so a row an Undo puts
 * back doesn't land again. The success toast is each logging path's job
 * (`toastMealLogged`), since only it holds the new log for Undo.
 */
export function useLandedMeal(logs: FoodLog[]): number | null {
  const seen = useRef<Set<number> | null>(null)
  const [landed, setLanded] = useState<number | null>(null)

  useEffect(() => {
    const before = seen.current
    seen.current = new Set([...(before ?? []), ...logs.map(l => l.id)])
    if (!before) return
    const fresh = logs.filter(l => !before.has(l.id))
    if (fresh.length === 0) return
    setLanded(fresh.reduce((a, b) => (b.id > a.id ? b : a)).id)
  }, [logs])

  useEffect(() => {
    if (landed == null) return
    const t = setTimeout(() => setLanded(null), 1900)
    return () => clearTimeout(t)
  }, [landed])

  return landed
}
