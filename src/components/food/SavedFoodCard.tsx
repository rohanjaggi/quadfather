'use client'

import { useState } from 'react'
import { useHaptic } from '@/components/TelegramProvider'
import { useUser } from '@/context/UserContext'
import { toast, errorMessage } from '@/components/ui/Toast'
import type { SavedFood } from '@/types/api'

interface Props {
  food: SavedFood
  onAdd: (food: SavedFood) => void | Promise<void>
  onDelete: (id: number) => void | Promise<void>
  isLast: boolean
}

export default function SavedFoodCard({ food, onAdd, onDelete, isLast }: Props) {
  const haptic = useHaptic()
  const { updateSavedFood } = useUser()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [name, setName] = useState(food.name)
  const [calories, setCalories] = useState(String(food.calories))
  const [protein, setProtein] = useState(String(food.protein))
  const [carbs, setCarbs] = useState(String(food.carbohydrates))
  const [fats, setFats] = useState(String(food.fats))
  const [fiber, setFiber] = useState(String(food.fiber ?? 0))

  async function handleAdd() {
    if (adding) return
    setAdding(true)
    haptic.impact('light')
    try {
      await onAdd(food)
    } catch (err) {
      toast(errorMessage(err, `Could not log ${food.name}`))
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await onDelete(food.id)
    } catch (err) {
      toast(errorMessage(err, 'Could not delete that favourite'))
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    setEditError(null)
    setName(food.name)
    setCalories(String(food.calories))
    setProtein(String(food.protein))
    setCarbs(String(food.carbohydrates))
    setFats(String(food.fats))
    setFiber(String(food.fiber ?? 0))
    setEditing(true)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setEditError(null)
    try {
      await updateSavedFood(food.id, {
        name,
        calories: Number(calories),
        protein: Number(protein),
        carbohydrates: Number(carbs),
        fats: Number(fats),
        fiber: Number(fiber),
      })
      setEditing(false)
    } catch (err) {
      setEditError(errorMessage(err, 'Could not save changes'))
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div style={{
        paddingBottom: isLast ? 0 : '14px',
        marginBottom: isLast ? 0 : '14px',
        borderBottom: isLast ? 'none' : '1px solid var(--surface-border)',
      }}>
        <div style={{ marginBottom: '8px' }}>
          <input
            className="input-field-bordered"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ fontSize: '14px' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
          <div>
            <label className="label-caps">Cal</label>
            <input className="input-field-bordered" type="number" min="0" value={calories} onChange={e => setCalories(e.target.value)} style={{ fontSize: '13px', padding: '8px 10px' }} />
          </div>
          <div>
            <label className="label-caps">Protein</label>
            <input className="input-field-bordered" type="number" min="0" step="0.1" value={protein} onChange={e => setProtein(e.target.value)} style={{ fontSize: '13px', padding: '8px 10px' }} />
          </div>
          <div>
            <label className="label-caps">Carbs</label>
            <input className="input-field-bordered" type="number" min="0" step="0.1" value={carbs} onChange={e => setCarbs(e.target.value)} style={{ fontSize: '13px', padding: '8px 10px' }} />
          </div>
          <div>
            <label className="label-caps">Fats</label>
            <input className="input-field-bordered" type="number" min="0" step="0.1" value={fats} onChange={e => setFats(e.target.value)} style={{ fontSize: '13px', padding: '8px 10px' }} />
          </div>
          <div>
            <label className="label-caps">Fiber</label>
            <input className="input-field-bordered" type="number" min="0" step="0.1" value={fiber} onChange={e => setFiber(e.target.value)} style={{ fontSize: '13px', padding: '8px 10px' }} />
          </div>
        </div>
        {editError && (
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            color: 'var(--accent-calories)', marginBottom: '8px', paddingLeft: '2px',
          }}>
            {editError}
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" onClick={() => { setEditError(null); setEditing(false) }} disabled={saving} style={{ flex: 1, padding: '10px' }}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      paddingBottom: isLast ? 0 : '14px',
      marginBottom: isLast ? 0 : '14px',
      borderBottom: isLast ? 'none' : '1px solid var(--surface-border)',
    }}>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--tg-theme-text-color)',
          marginBottom: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {food.name}
        </p>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          color: 'var(--tg-theme-hint-color)',
        }}>
          {Math.round(food.calories)} kcal · {Math.round(food.protein)}g P · {Math.round(food.carbohydrates)}g C · {Math.round(food.fats)}g F · {Math.round(food.fiber ?? 0)}g Fi
        </p>
      </div>

      {/* Edit — 0.35 opacity put the glyph at 2.2:1 on the card, under the 3:1
          WCAG minimum for a UI control; 0.55 clears it at 3.8:1. */}
      <button
        onClick={handleEdit}
        aria-label={`Edit ${food.name}`}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px',
          cursor: 'pointer',
          opacity: 0.55,
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--tg-theme-text-color)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
        </svg>
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`Delete ${food.name} from favourites`}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px',
          cursor: deleting ? 'not-allowed' : 'pointer',
          opacity: deleting ? 0.15 : 0.55,
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--tg-theme-text-color)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>

      {/* Add to today */}
      <button
        onClick={handleAdd}
        disabled={adding}
        className="btn-primary"
        style={{
          width: 'auto',
          padding: '8px 14px',
          borderRadius: '99px',
          fontSize: '12px',
          flexShrink: 0,
        }}
      >
        {adding ? '…' : '+ Add'}
      </button>

    </div>
  )
}
