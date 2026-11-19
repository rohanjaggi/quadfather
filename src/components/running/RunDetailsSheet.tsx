'use client'

import { useEffect, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'
import { TrashIcon } from '@/components/ui/icons'
import { errorMessage } from '@/lib/errors'
import { formatDuration, formatInt, formatPace, formatTime } from '@/lib/format'
import { dayKey } from '@/lib/day'
import { EXERCISE_DAMPENING } from '@/lib/constants'
import { formatKm, formatRunDate, isStrava, runPace, sourceLabel } from './RunCard'
import type { RunLog } from '@/types/running'

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '11px 0',
}

/**
 * One run: its numbers, whether it counts toward the food budget, and delete
 * behind a confirm step. `onClose` must be stable (Sheet's focus effect).
 */
export default function RunDetailsSheet({ run, onClose }: { run: RunLog | null; onClose: () => void }) {
  const { toggleRunAllowance, deleteRun } = useUser()
  const haptic = useHaptic()
  const [added, setAdded] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!run) return
    setAdded(run.added_to_allowance !== false)
    setConfirming(false)
  }, [run])

  if (!run) return null

  const today = dayKey(new Date(run.run_date)) === dayKey()
  const credit = Math.round(run.calories_burned * EXERCISE_DAMPENING)
  const current = run

  async function toggle() {
    if (saving) return
    const next = !added
    setAdded(next)
    setSaving(true)
    haptic.selection()
    try {
      await toggleRunAllowance(current.id, next)
    } catch (err) {
      setAdded(!next)
      haptic.notification('error')
      toast(errorMessage(err, "Couldn't update this run. Try again."))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (deleting) return
    setDeleting(true)
    haptic.notification('warning')
    try {
      await deleteRun(current.id)
      toast('Run deleted', { type: 'success' })
      onClose()
    } catch (err) {
      haptic.notification('error')
      toast(errorMessage(err, 'Could not delete this run'))
    } finally {
      setDeleting(false)
    }
  }

  const rows: [string, string][] = [
    ['Time', formatDuration(run.duration_seconds)],
    ['Pace', `${formatPace(runPace(run), 'min')} /km`],
    ...(run.average_heartrate != null ? [['Heart rate', `${Math.round(run.average_heartrate)} bpm`] as [string, string]] : []),
    ...(run.elevation_gain != null ? [['Elevation gain', `${Math.round(run.elevation_gain)} m`] as [string, string]] : []),
    ['Calories burned', `${formatInt(run.calories_burned)} kcal`],
    ['Source', sourceLabel(run)],
  ]

  return (
    <Sheet open={!!run} onClose={onClose} title={`${formatKm(run.distance_meters)} run`}>
      {confirming ? (
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>Delete this run?</p>
          <p style={{ margin: '6px 0 20px', fontSize: 15, lineHeight: 1.45, color: 'var(--muted)' }}>
            {formatKm(run.distance_meters)} from {formatRunDate(run.run_date).replace(/^(Today|Yesterday)$/, s => s.toLowerCase())}.
            {' '}Its kcal come off {today ? "today's" : "that day's"} budget
            {isStrava(run) ? ", and the next Strava sync won't bring it back." : '.'}
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={remove}
            disabled={deleting}
            style={{ background: 'var(--over)', boxShadow: 'none' }}
          >
            {deleting ? 'Deleting…' : 'Delete run'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} style={{ width: '100%', marginTop: 8 }}>
            Keep it
          </button>
        </div>
      ) : (
        <>
          <p style={{ margin: '-6px 0 14px', fontSize: 15, color: 'var(--muted)' }}>
            {formatRunDate(run.run_date)}, {formatTime(run.run_date)}{run.name ? ` · ${run.name}` : ''}
          </p>

          <div className="card" style={{ padding: '4px 18px' }}>
            {rows.map(([label, value], i) => (
              <div key={label} style={{ ...rowStyle, borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 15, color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 10, padding: '10px 10px 10px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p id="run-budget-label" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                Add to {today ? "today's" : "that day's"} budget
              </p>
              <p id="run-budget-hint" style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.4, color: 'var(--muted)' }}>
                {added ? `+${formatInt(credit)} kcal, half of this run's burn` : "Off: this run doesn't change what you can eat"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={added}
              aria-labelledby="run-budget-label"
              aria-describedby="run-budget-hint"
              onClick={toggle}
              disabled={saving}
              style={{ width: 60, height: 44, flexShrink: 0, border: 'none', padding: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}
            >
              <span aria-hidden="true" style={{
                position: 'relative', width: 50, height: 30, borderRadius: 15,
                background: added ? 'var(--action)' : 'var(--line-strong)',
                transition: 'background-color 0.2s ease',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: added ? 22 : 2, width: 26, height: 26, borderRadius: '50%',
                  background: '#FFFFFF', boxShadow: '0 1px 3px rgba(31,42,36,.28)',
                  transition: 'left 0.25s var(--ease-out-expo)',
                }} />
              </span>
            </button>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => setConfirming(true)}
            style={{ width: '100%', marginTop: 14, color: 'var(--over)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <TrashIcon size={18} /> Delete run
          </button>
        </>
      )}
    </Sheet>
  )
}
