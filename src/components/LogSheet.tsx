'use client'

import { useRouter } from 'next/navigation'
import { useState, type ComponentType } from 'react'
import Sheet from '@/components/ui/Sheet'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'
import { toastLogged } from '@/components/food/logged'
import { errorMessage } from '@/lib/errors'
import {
  BookmarkIcon, CameraIcon, ChevronRightIcon, EditIcon, PlusIcon, RunIcon, TextIcon, TrainingIcon, WaterIcon,
} from '@/components/ui/icons'

type Row = { label: string; hint?: string; href: string; Icon: ComponentType<{ size?: number }> }

const MEAL: Row[] = [
  { label: 'Snap a photo', href: '/food?mode=photo', Icon: CameraIcon },
  { label: 'Describe it', hint: 'Type what you ate', href: '/food?mode=describe', Icon: TextIcon },
  { label: 'Log again', hint: 'Recent meals and saved foods', href: '/food?mode=again', Icon: BookmarkIcon },
  { label: 'Enter manually', href: '/food?mode=manual', Icon: EditIcon },
]

const TRAINING: Row[] = [
  { label: 'Workout', href: '/workouts/log', Icon: TrainingIcon },
  { label: 'Run', href: '/running?log=1', Icon: RunIcon },
]

const groupTitle: React.CSSProperties = { margin: '0 4px 8px', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 54,
  padding: '0 16px', border: 'none', background: 'transparent', textAlign: 'left',
  fontSize: 16, fontWeight: 500, color: 'var(--ink)',
}

export default function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { user, savedFoods, foodLogs, logWater, deleteWater } = useUser()
  // With nothing saved and nothing logged yet, "Log again" would land on nothing.
  // shortcut: today's logs stand in for "has history"; a user whose only meals are
  // from earlier days loses this row until they log today. Use a history count if one appears.
  const mealRows = savedFoods.length > 0 || foodLogs.length > 0 ? MEAL : MEAL.filter(r => r.href !== '/food?mode=again')
  const haptic = useHaptic()
  const [adding, setAdding] = useState(false)
  const bottle = user?.water_bottle_size ?? 0.5

  const go = (href: string) => {
    haptic.selection()
    onClose()
    router.push(href)
  }

  async function addBottle() {
    if (adding) return
    setAdding(true)
    try {
      const log = await logWater({ bottles: 1 })
      haptic.notification('success')
      toastLogged(`Water logged · ${log.amount_liters.toFixed(1)} L`, () => deleteWater(log.id, { undoable: false }))
      onClose()
    } catch (err) {
      haptic.notification('error')
      toast(errorMessage(err, "Couldn't log water. Try again."))
    } finally {
      setAdding(false)
    }
  }

  const renderRows = (rows: Row[]) => rows.map(({ label, hint, href, Icon }, i) => (
    <button key={href} type="button" onClick={() => go(href)} style={{ ...rowStyle, borderTop: i ? '1px solid var(--line)' : 'none' }}>
      <span style={{ color: 'var(--muted)', display: 'grid' }}><Icon size={22} /></span>
      <span style={{ flex: 1 }}>
        {label}
        {hint && <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>{hint}</span>}
      </span>
      <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
    </button>
  ))

  return (
    <Sheet open={open} onClose={onClose} title="Log">
      <p style={groupTitle}>Meal</p>
      <div className="card" style={{ padding: 0, marginBottom: 18 }}>{renderRows(mealRows)}</div>

      <p style={groupTitle}>Water</p>
      <div className="card" style={{ padding: 0, marginBottom: 18 }}>
        <div style={{ ...rowStyle, cursor: 'default' }}>
          <span style={{ color: 'var(--muted)', display: 'grid' }}><WaterIcon size={22} /></span>
          <span style={{ flex: 1 }}>
            One bottle
            <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>{bottle.toFixed(1)} L</span>
          </span>
          <button
            type="button"
            className="btn-pill"
            data-active="true"
            onClick={addBottle}
            disabled={adding}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 40 }}
          >
            <PlusIcon size={16} /> {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        <button type="button" onClick={() => go('/water?amount')} style={{ ...rowStyle, borderTop: '1px solid var(--line)' }}>
          <span style={{ width: 22 }} />
          <span style={{ flex: 1 }}>Other amount</span>
          <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
        </button>
      </div>

      <p style={groupTitle}>Training</p>
      <div className="card" style={{ padding: 0 }}>{renderRows(TRAINING)}</div>
    </Sheet>
  )
}
