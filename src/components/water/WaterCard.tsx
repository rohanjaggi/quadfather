'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WaterPips } from '@/components/ui/MetricMinis'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { toast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { ChevronRightIcon, PlusIcon } from '@/components/ui/icons'

/** Food tab's water row: today's bottles (links to /water) and one-tap add. */
export default function WaterCard() {
  const { user, summary, logWater } = useUser()
  const haptic = useHaptic()
  const [adding, setAdding] = useState(false)
  const liters = summary?.water.total ?? 0
  const goal = user?.goals.daily_water_goal ?? 3
  const bottle = user?.water_bottle_size ?? 0.5

  async function addBottle() {
    if (adding) return
    setAdding(true)
    haptic.impact('light')
    try {
      await logWater({ bottles: 1 })
      toast(`Water logged · ${bottle.toFixed(1)} L`, { type: 'success' })
    } catch (err) {
      toast(errorMessage(err, 'Could not log water'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <section className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 14 }}>
      <Link
        href="/water"
        aria-label={`Water: ${liters.toFixed(1)} of ${goal.toFixed(1)} litres. Open water`}
        style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, color: 'var(--ink)', textDecoration: 'none' }}
      >
        <WaterPips liters={liters} goalLiters={goal} bottleSize={bottle} />
        <span style={{ display: 'grid', color: 'var(--muted)', marginBottom: 1 }}><ChevronRightIcon size={18} /></span>
      </Link>
      <button
        type="button"
        className="btn-pill"
        data-active="true"
        onClick={addBottle}
        disabled={adding}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, flexShrink: 0 }}
      >
        <PlusIcon size={16} /> {adding ? 'Adding…' : 'Add bottle'}
      </button>
    </section>
  )
}
