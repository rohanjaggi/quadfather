'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import Sheet from '@/components/ui/Sheet'
import ManualFoodForm, { type FoodValues } from '@/components/food/ManualFoodForm'
import { savedFoodLog } from '@/components/food/SavedFoodsCard'
import { macroLine } from '@/components/food/meals'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { formatInt } from '@/lib/format'
import type { SavedFood } from '@/types/api'

const caption: React.CSSProperties = { margin: 0, fontSize: 13, color: 'var(--muted)' }

export default function FavouritesPage() {
  const { savedFoods, logFood } = useUser()
  const haptic = useHaptic()
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  const selected = savedFoods.find(f => f.id === openId) ?? null

  async function handleLog(food: SavedFood) {
    if (pendingId !== null) return
    setPendingId(food.id)
    haptic.impact('light')
    try {
      await logFood(savedFoodLog(food))
      haptic.notification('success')
      toast(`Logged · ${formatInt(food.calories)} kcal`, { type: 'success' })
    } catch (err) {
      haptic.notification('error')
      toast(errorMessage(err, `Could not log ${food.name}`))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Saved foods"
        subtitle={savedFoods.length > 0 ? `${savedFoods.length} saved · tap one to edit` : undefined}
        back={{ href: '/food', label: 'Food' }}
      />

      {savedFoods.length === 0 ? (
        <section className="card">
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
            Nothing saved yet. Describe or snap a meal, then tap &ldquo;Save to favourites&rdquo; on its estimate to keep it here.
          </p>
          <Link href="/food?mode=describe" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, textDecoration: 'none' }}>
            Describe a meal
          </Link>
        </section>
      ) : (
        <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
          {savedFoods.map((food, i) => (
            <div key={food.id} style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`Edit ${food.name}`}
                onClick={() => setOpenId(food.id)}
                style={{ flex: 1, minWidth: 0, minHeight: 64, padding: '10px 0', border: 'none', background: 'none', textAlign: 'left', color: 'var(--ink)' }}
              >
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.name}</span>
                <span style={{ ...caption, display: 'block', marginTop: 2 }}>{formatInt(food.calories)} kcal · {macroLine(food)}</span>
              </button>
              <button
                type="button"
                className="btn-pill"
                data-active="true"
                onClick={() => handleLog(food)}
                disabled={pendingId !== null}
                aria-label={`Log ${food.name}`}
                style={{ flexShrink: 0, minHeight: 40 }}
              >
                {pendingId === food.id ? 'Logging…' : 'Log'}
              </button>
            </div>
          ))}
        </section>
      )}

      <Sheet open={selected != null} onClose={close} title={selected?.name ?? ''}>
        {selected && <SavedFoodEditor key={selected.id} food={selected} onDone={close} />}
      </Sheet>
    </div>
  )
}

/** Edit a saved food, or delete it after a confirm step. */
function SavedFoodEditor({ food, onDone }: { food: SavedFood; onDone: () => void }) {
  const { updateSavedFood, deleteSavedFood } = useUser()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave(v: FoodValues) {
    await updateSavedFood(food.id, {
      name: v.food_name,
      calories: v.calories,
      protein: v.protein,
      carbohydrates: v.carbohydrates,
      fats: v.fats,
      fiber: v.fiber,
    })
    onDone()
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteSavedFood(food.id)
      onDone()
    } catch (err) {
      toast(errorMessage(err, 'Could not delete that saved food'))
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: '0 0 6px', fontSize: 15 }}>
          Delete &ldquo;{food.name}&rdquo; from saved foods? Meals you&apos;ve already logged stay.
        </p>
        <button type="button" className="btn-secondary" onClick={handleDelete} disabled={deleting} style={{ color: 'var(--over)' }}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>
          Keep it
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ManualFoodForm
        initial={{ ...food, food_name: food.name, fiber: food.fiber ?? 0 }}
        onApply={handleSave}
        submitLabel="Save changes"
      />
      <button type="button" className="btn-ghost" onClick={() => setConfirming(true)} style={{ color: 'var(--over)' }}>
        Delete from saved foods
      </button>
    </div>
  )
}
