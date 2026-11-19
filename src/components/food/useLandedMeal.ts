'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from '@/components/ui/Toast'
import { formatInt } from '@/lib/format'
import type { FoodLog } from '@/types/api'

/**
 * The id of a meal that just appeared in today's list, for one `.row-landed`
 * moment, plus the "Logged · 690 kcal" toast. Ids present on mount count as
 * seen, so only a row that arrives while the page is open lands. Announcing
 * from the list (not each logging path) means the toast carries the stored
 * kcal, servings applied, whichever control logged it.
 */
export function useLandedMeal(logs: FoodLog[]): number | null {
  const seen = useRef<Set<number> | null>(null)
  const [landed, setLanded] = useState<number | null>(null)

  useEffect(() => {
    const before = seen.current
    seen.current = new Set(logs.map(l => l.id))
    if (!before) return
    const fresh = logs.filter(l => !before.has(l.id))
    if (fresh.length === 0) return
    const newest = fresh.reduce((a, b) => (b.id > a.id ? b : a))
    setLanded(newest.id)
    toast(`Logged · ${formatInt(newest.calories)} kcal`, { type: 'success' })
  }, [logs])

  useEffect(() => {
    if (landed == null) return
    const t = setTimeout(() => setLanded(null), 1900)
    return () => clearTimeout(t)
  }, [landed])

  return landed
}
