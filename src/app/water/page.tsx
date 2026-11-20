'use client'

import { useCallback, useId, useRef, useState, useEffect } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import SummaryCard from '@/components/dashboard/SummaryCard'
import Sheet from '@/components/ui/Sheet'
import SwipeToDelete, { SwipeDeleteProvider } from '@/components/SwipeToDelete'
import BottomDock, { dockedPageStyle } from '@/components/food/BottomDock'
import BottleCounter, { formatLiters } from '@/components/water/BottleCounter'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { formatTime } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { toastLogged } from '@/components/food/logged'
import type { WaterLog, WaterLogCreate } from '@/types/api'

type Busy = null | 'add' | 'custom'

const caption: React.CSSProperties = { margin: 0, fontSize: 13, color: 'var(--muted)' }

export default function WaterPage() {
  const { user, summary, waterLogs, logWater, deleteWater } = useUser()
  const haptic = useHaptic()
  const amountId = useId()

  const [busy, setBusy] = useState<Busy>(null)
  const [customOpen, setCustomOpen] = useState(false)
  // `/water?amount` (from the Log sheet's "Other amount") opens the sheet
  // straight away; the flag is then dropped so a reload doesn't reopen it.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('amount')) return
    setCustomOpen(true)
    window.history.replaceState(null, '', window.location.pathname)
  }, [])
  const [customAmount, setCustomAmount] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  // Ref, not state: a second tap in the same tick still sees the flag set, so
  // one tap can never turn into two POSTs (and two full context refreshes).
  const inFlight = useRef(false)
  // A horizontal swipe can still end in a click; ignore taps that travelled.
  const downX = useRef(0)

  const closeCustom = useCallback(() => { setCustomOpen(false); setCustomAmount('') }, [])
  const closeEntry = useCallback(() => setOpenId(null), [])

  const totalLiters = summary?.water.total ?? 0
  const goal = user?.goals.daily_water_goal ?? 3
  const bottleSize = user?.water_bottle_size ?? 0.5

  /** Logs water, one request at a time; rejects (after a toast) when another is in flight or it fails. */
  async function add(kind: Exclude<Busy, null>, data: WaterLogCreate) {
    if (inFlight.current) throw new Error('Another water change is still saving')
    inFlight.current = true
    setBusy(kind)
    try {
      const log = await logWater(data)
      toastLogged(`Water logged · ${formatLiters(log.amount_liters)} L`, () => deleteWater(log.id, { undoable: false }))
    } catch (err) {
      toast(errorMessage(err, 'Could not log water'))
      throw err
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  function handleAdd() {
    haptic.impact('light')
    add('add', { bottles: 1 }).catch(() => {})
  }

  function handleCustomAdd(e: React.FormEvent) {
    e.preventDefault()
    const ml = parseFloat(customAmount)
    if (!(ml > 0)) return
    add('custom', { amount_liters: ml / 1000 }).then(closeCustom, () => {})
  }

  // Undoable: the row leaves at once and the toast offers Undo.
  const removeEntry = (id: number) => deleteWater(id)

  const customMl = parseFloat(customAmount)
  const customValid = customMl > 0

  // Running totals, oldest first (the context keeps newest first).
  const logsAsc = [...waterLogs].reverse()
  let acc = 0
  const timeline = logsAsc.map(log => ({ log, running: (acc += log.amount_liters) }))
  const selected = timeline.find(t => t.log.id === openId) ?? null

  return (
    <div style={dockedPageStyle}>
      <PageHeader title="Water" back={{ href: '/food', label: 'Food' }} />

      <section className="card" style={{ padding: '22px 20px' }}>
        <BottleCounter liters={totalLiters} goal={goal} bottleSize={bottleSize} />
      </section>

      <SummaryCard title="Today's log">
        {timeline.length === 0 ? (
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>No water logged yet today.</p>
        ) : (
          <SwipeDeleteProvider>
            {timeline.map(({ log, running }, i) => (
              <SwipeToDelete key={log.id} id={`water-${log.id}`} onDelete={() => removeEntry(log.id)}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`${formatLiters(log.amount_liters)} litres at ${formatTime(log.logged_at)}, ${formatLiters(running)} litres by then`}
                  onPointerDown={e => { downX.current = e.clientX }}
                  onClick={e => { if (e.detail === 0 || Math.abs(e.clientX - downX.current) < 10) setOpenId(log.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52,
                    padding: '8px 0', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none',
                    background: 'transparent', textAlign: 'left', color: 'var(--ink)',
                  }}
                >
                  <span style={{ ...caption, width: 44, flexShrink: 0 }}>{formatTime(log.logged_at)}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, width: 64, flexShrink: 0 }}>+{formatLiters(log.amount_liters)} L</span>
                  <span aria-hidden="true" style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--track)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(running / goal, 1) * 100}%`, background: 'var(--m-water)' }} />
                  </span>
                  <span style={{ ...caption, width: 44, flexShrink: 0, textAlign: 'right' }}>{formatLiters(running)} L</span>
                </button>
              </SwipeToDelete>
            ))}
          </SwipeDeleteProvider>
        )}
      </SummaryCard>

      <BottomDock>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={() => setCustomOpen(true)} style={{ flex: 1, minHeight: 52 }}>
            Other amount
          </button>
          <button type="button" className="btn-primary" onClick={handleAdd} disabled={busy !== null} style={{ flex: 1.5 }}>
            {busy === 'add' ? 'Adding…' : 'Add a bottle'}
          </button>
        </div>
      </BottomDock>

      <Sheet open={customOpen} onClose={closeCustom} title="Other amount">
        <form onSubmit={handleCustomAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor={amountId} className="label-caps">Amount</label>
            <div style={{ position: 'relative' }}>
              <input
                id={amountId}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="250"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                autoFocus
                className="input-field"
                style={{ fontSize: 20, padding: '14px 48px 14px 16px' }}
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)', pointerEvents: 'none' }}>
                ml
              </span>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={busy !== null || !customValid}>
            {busy === 'custom' ? 'Saving…' : customValid ? `Add ${customAmount} ml` : 'Add water'}
          </button>
        </form>
      </Sheet>

      <Sheet open={selected != null} onClose={closeEntry} title={selected ? `Water at ${formatTime(selected.log.logged_at)}` : ''}>
        {selected && <EntryDetail entry={selected.log} running={selected.running} onRemove={removeEntry} onDone={closeEntry} />}
      </Sheet>
    </div>
  )
}

function EntryDetail({ entry, running, onRemove, onDone }: {
  entry: WaterLog
  running: number
  onRemove: (id: number) => Promise<void>
  onDone: () => void
}) {
  const haptic = useHaptic()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (deleting) return
    haptic.notification('warning')
    setDeleting(true)
    try {
      await onRemove(entry.id)
      onDone()
    } catch {
      setDeleting(false) // the toast already said what went wrong
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>+{formatLiters(entry.amount_liters)}</span>
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--muted)' }}>L</span>
        </p>
        <p style={{ ...caption, marginTop: 6, fontSize: 14 }}>{formatLiters(running)} L by then</p>
      </div>
      <button type="button" className="btn-ghost" onClick={handleDelete} disabled={deleting} style={{ color: 'var(--over)' }}>
        {deleting ? 'Deleting…' : 'Delete entry'}
      </button>
    </div>
  )
}
