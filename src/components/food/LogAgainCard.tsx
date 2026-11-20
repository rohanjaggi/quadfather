'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import SummaryCard from '@/components/dashboard/SummaryCard'
import Segmented from '@/components/ui/Segmented'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { formatInt } from '@/lib/format'
import { addDays, dayKey } from '@/lib/day'
import * as api from '@/lib/api'
import { MEAL_NAME, partOfDay } from '@/components/food/meals'
import { toastLogged, toastMealLogged } from '@/components/food/logged'
import type { FoodLog, FoodLogCreate, SavedFood } from '@/types/api'

export type LogAgainTab = 'recent' | 'saved'

/**
 * Logs a saved food. `saved_food_id` links the log back to the favourite it
 * came from, which is what "In your saved foods" reads on each meal; without
 * it the row falls back to matching on the name, so a rename gets it wrong.
 */
export function savedFoodLog(food: SavedFood): FoodLogCreate {
  return {
    food_name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbohydrates: food.carbohydrates,
    fats: food.fats,
    fiber: food.fiber,
    source: food.source,
    saved_food_id: food.id,
  }
}

/** A past meal again, now: same name, its stored totals as one serving. */
function repeatLog(log: FoodLog): FoodLogCreate {
  return {
    food_name: log.food_name,
    calories: log.calories,
    protein: log.protein,
    carbohydrates: log.carbohydrates,
    fats: log.fats,
    fiber: log.fiber,
    source: 'repeat',
  }
}

const linkStyle: React.CSSProperties = { display: 'inline-block', padding: '12px 0', margin: '-12px 0', fontSize: 15, fontWeight: 600, color: 'var(--action)', textDecoration: 'none' }
const empty: React.CSSProperties = { margin: '12px 0 0', fontSize: 14, color: 'var(--muted)' }

/**
 * One-tap re-log: "Same as yesterday's lunch" when it applies, then recent
 * meals or saved foods as chips. `requested` (from a `?mode=again|saved` deep
 * link) picks the tab and scrolls the card into view; a new object re-requests.
 */
export default function LogAgainCard({ requested }: { requested: { tab: LogAgainTab } | null }) {
  const { savedFoods, foodLogs, logFood, deleteFood, refresh } = useUser()
  const haptic = useHaptic()
  const ref = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<{ recent: FoodLog[]; yesterday: FoodLog[] } | null>(null)
  const [tab, setTab] = useState<LogAgainTab | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.allSettled([api.getRecentFoods(), api.getFoodLogs(addDays(dayKey(), -1))]).then(([recent, yesterday]) => {
      if (!live) return
      // A shortcut card: a failed fetch just leaves that part out.
      if (recent.status === 'rejected') console.error('Failed to load recent meals:', recent.reason)
      if (yesterday.status === 'rejected') console.error("Failed to load yesterday's meals:", yesterday.reason)
      setData({
        recent: recent.status === 'fulfilled' ? recent.value : [],
        yesterday: yesterday.status === 'fulfilled' ? yesterday.value : [],
      })
    })
    return () => { live = false }
  }, [])

  useEffect(() => { if (requested) setTab(requested.tab) }, [requested])
  // Waits for the data so the card is at its final height before scrolling.
  useEffect(() => {
    if (requested && data) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [requested, data])

  async function logOne(key: string, meal: FoodLogCreate) {
    if (pending !== null) return
    setPending(key)
    haptic.impact('light')
    try {
      toastMealLogged(await logFood(meal), deleteFood)
    } catch (err) {
      toast(errorMessage(err, `Could not log ${meal.food_name}`))
    } finally {
      setPending(null)
    }
  }

  /** Logs every meal in one go with one refresh, then one toast whose Undo removes them all. */
  async function logAll(meals: FoodLog[], name: string) {
    if (pending !== null) return
    setPending('yesterday')
    haptic.impact('light')
    const results = await Promise.allSettled(meals.map(m => api.logFood(repeatLog(m))))
    await refresh()
    setPending(null)
    const logged = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
    if (logged.length === 0) {
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      toast(errorMessage(failed?.reason, `Could not log yesterday's ${name}`))
      return
    }
    const what = logged.length === meals.length
      ? `yesterday's ${name}`
      : `${logged.length} of ${meals.length} from yesterday's ${name}`
    const kcal = logged.reduce((s, l) => s + l.calories, 0)
    toastLogged(`Logged ${what} · ${formatInt(kcal)} kcal`, async () => {
      // Every delete runs to completion, so a partial failure is reported exactly.
      const undone = await Promise.allSettled(logged.map(l => api.deleteFood(l.id)))
      await refresh()
      const removed = undone.filter(r => r.status === 'fulfilled').length
      if (removed < logged.length) {
        throw new Error(`Removed ${removed} of ${logged.length}. The rest are still logged.`)
      }
    })
  }

  if (!data) return null
  const { recent } = data
  if (recent.length === 0 && savedFoods.length === 0) return null

  const shown = tab ?? (recent.length > 0 ? 'recent' : 'saved')
  const part = partOfDay(new Date().toISOString())
  const name = MEAL_NAME[part]
  // Only while today has nothing in this part of the day yet.
  const again = foodLogs.some(l => partOfDay(l.logged_at) === part)
    ? []
    : data.yesterday.filter(l => partOfDay(l.logged_at) === part)
  const againKcal = again.reduce((s, l) => s + l.calories, 0)
  const busy = pending !== null

  const chips = shown === 'recent'
    ? recent.map(l => ({ key: `r${l.id}`, name: l.food_name, kcal: l.calories, meal: repeatLog(l) }))
    : savedFoods.map(f => ({ key: `s${f.id}`, name: f.name, kcal: f.calories, meal: savedFoodLog(f) }))

  return (
    <div ref={ref} style={{ scrollMarginTop: 16, scrollMarginBottom: 120 }}>
      <SummaryCard
        title="Log again"
        action={shown === 'saved' && savedFoods.length > 0 && <Link href="/food/favourites" style={linkStyle}>See all</Link>}
      >
        {again.length > 0 && (
          <button
            type="button"
            className="btn-pill"
            data-active="true"
            onClick={() => logAll(again, name)}
            disabled={busy}
            style={{
              width: '100%', minHeight: 48, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: busy && pending !== 'yesterday' ? 0.5 : 1,
            }}
          >
            {pending === 'yesterday' ? 'Logging…' : (
              <>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Same as yesterday&apos;s {name}</span>
                <span style={{ fontWeight: 500, flexShrink: 0 }}>
                  · {again.length} {again.length === 1 ? 'item' : 'items'} · {formatInt(againKcal)} kcal
                </span>
              </>
            )}
          </button>
        )}

        <Segmented
          label="Log again from"
          options={[{ value: 'recent', label: 'Recent' }, { value: 'saved', label: 'Saved' }]}
          value={shown}
          onChange={setTab}
        />

        {chips.length === 0 ? (
          <p style={empty}>
            {shown === 'recent'
              ? 'Meals you log show up here, ready to log again.'
              : 'Nothing saved yet. Open a meal and tap “Save to favourites”.'}
          </p>
        ) : (
          <div
            role="list"
            aria-label={shown === 'recent' ? 'Log a recent meal' : 'Log a saved food'}
            style={{
              display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none',
              margin: '12px -20px 0', padding: '2px 20px',
            }}
          >
            {chips.map(c => (
              <div role="listitem" key={c.key} style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn-pill"
                  onClick={() => logOne(c.key, c.meal)}
                  disabled={busy}
                  aria-label={`Log ${c.name}, ${formatInt(c.kcal)} kcal`}
                  style={{
                    minHeight: 44, maxWidth: 240, display: 'inline-flex', alignItems: 'center', gap: 6,
                    opacity: busy && pending !== c.key ? 0.5 : 1,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>
                    {pending === c.key ? 'Logging…' : `${formatInt(c.kcal)} kcal`}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </SummaryCard>
    </div>
  )
}
