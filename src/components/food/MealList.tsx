'use client'

import { Fragment, useCallback, useRef, useState } from 'react'
import SwipeToDelete, { SwipeDeleteProvider } from '@/components/SwipeToDelete'
import Sheet from '@/components/ui/Sheet'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { formatInt, formatTime } from '@/lib/format'
import { groupByPartOfDay, macroLine, partOfDay } from '@/components/food/meals'
import type { FoodLog } from '@/types/api'

const muted: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginTop: 2 }

/**
 * A day's meals grouped by part of day. Tapping a row opens its details (save
 * to favourites, and delete when `onDelete` is given); rows also swipe to
 * delete.
 */
export default function MealList({ logs, landedId, onDelete }: {
  logs: FoodLog[]
  /** The row that just arrived from a log: plays `.row-landed` once. */
  landedId?: number | null
  /** Must reject on failure (after surfacing it) so a swiped row comes back. */
  onDelete?: (id: number) => Promise<void>
}) {
  const [openId, setOpenId] = useState<number | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  // A horizontal swipe can still end in a click; ignore taps that travelled
  // (`detail === 0` is a keyboard click, which has no pointer position).
  const downX = useRef(0)
  const selected = logs.find(l => l.id === openId) ?? null

  return (
    <>
      <SwipeDeleteProvider>
        {groupByPartOfDay(logs).map((group, gi) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: gi ? '14px 0 2px' : '0 0 2px',
              fontSize: 13, fontWeight: 600, color: 'var(--muted)',
            }}>
              <span>{group.label}</span>
              <span style={{ fontWeight: 500 }}>{formatInt(group.kcal)} kcal</span>
            </div>
            {group.logs.map((log, i) => {
              const row = (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  className={log.id === landedId ? 'row-landed' : undefined}
                  onPointerDown={e => { downX.current = e.clientX }}
                  onClick={e => { if (e.detail === 0 || Math.abs(e.clientX - downX.current) < 10) setOpenId(log.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60,
                    padding: '10px 0', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none',
                    background: 'transparent', textAlign: 'left', color: 'var(--ink)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.food_name}
                    </span>
                    <span style={muted}>{macroLine(log)}</span>
                  </span>
                  <span style={{ flexShrink: 0, textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{formatInt(log.calories)} kcal</span>
                    <span style={muted}>{formatTime(log.logged_at)}</span>
                  </span>
                </button>
              )
              return onDelete
                ? <SwipeToDelete key={log.id} id={`meal-${log.id}`} onDelete={() => onDelete(log.id)}>{row}</SwipeToDelete>
                : <Fragment key={log.id}>{row}</Fragment>
            })}
          </div>
        ))}
      </SwipeDeleteProvider>

      <Sheet open={selected != null} onClose={close} title={selected?.food_name ?? ''}>
        {selected && <MealDetail key={selected.id} log={selected} onClose={close} onDelete={onDelete} />}
      </Sheet>
    </>
  )
}

function MealDetail({ log, onClose, onDelete }: {
  log: FoodLog
  onClose: () => void
  onDelete?: (id: number) => Promise<void>
}) {
  const haptic = useHaptic()
  const { saveFood, savedFoods } = useUser()
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isFavourited = justSaved || log.saved_food_id != null ||
    savedFoods.some(f => f.name.toLowerCase() === log.food_name.toLowerCase())

  async function handleFavourite() {
    if (isFavourited || saving) return
    setSaving(true)
    try {
      await saveFood({
        name: log.food_name,
        calories: Math.round(log.calories),
        protein: Math.round(log.protein),
        carbohydrates: Math.round(log.carbohydrates),
        fats: Math.round(log.fats),
        fiber: Math.round(log.fiber ?? 0),
        source: 'logged',
      })
      haptic.notification('success')
      setJustSaved(true)
    } catch (err) {
      haptic.notification('error')
      toast(errorMessage(err, 'Could not save to favourites'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || deleting) return
    haptic.notification('warning')
    setDeleting(true)
    try {
      await onDelete(log.id)
      onClose()
    } catch {
      setDeleting(false) // onDelete already said what went wrong
    }
  }

  const rows = [
    ['Protein', log.protein],
    ['Carbs', log.carbohydrates],
    ['Fat', log.fats],
    ['Fibre', log.fiber ?? 0],
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{formatInt(log.calories)}</span>
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--muted)' }}>kcal</span>
        </p>
        <p style={{ ...muted, marginTop: 4 }}>
          {partOfDay(log.logged_at)} · {formatTime(log.logged_at)}
          {log.servings !== 1 && ` · ${log.servings} servings`}
        </p>
        <dl style={{ margin: '14px 0 0' }}>
          {rows.map(([label, value], i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <dt style={{ color: 'var(--muted)' }}>{label}</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{formatInt(value)} g</dd>
            </div>
          ))}
        </dl>
      </div>

      <button type="button" className="btn-secondary" onClick={handleFavourite} disabled={isFavourited || saving}>
        {isFavourited ? 'In your saved foods' : saving ? 'Saving…' : 'Save to favourites'}
      </button>
      {onDelete && (
        <button type="button" className="btn-ghost" onClick={handleDelete} disabled={deleting} style={{ color: 'var(--over)' }}>
          {deleting ? 'Deleting…' : 'Delete meal'}
        </button>
      )}
    </div>
  )
}
