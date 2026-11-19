'use client'

import { useEffect, useRef, useState } from 'react'
import { getRunPRs } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import SummaryCard from '@/components/dashboard/SummaryCard'
import type { RunPR } from '@/types/running'

/**
 * `/api/runs/prs` sends a bare `YYYY-MM-DD`, which was being rendered raw
 * ("2026-08-19") next to every other PR date in the app, which is formatted.
 * Parsed and formatted in UTC — `new Date('2026-08-19')` is UTC midnight, so
 * formatting it locally would show the 18th anywhere west of UTC.
 */
function formatPrDate(iso: string): string {
  if (!iso) return ''
  const parsed = new Date(iso.includes('T') ? iso : `${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

/** The API sends Title Case ("Fastest Pace"); the app speaks sentence case. "5K" stays. */
const sentenceCase = (label: string) => label.replace(/ ([A-Z])([a-z]+)/g, (_, a: string, b: string) => ` ${a.toLowerCase()}${b}`)

// The landing wash on the new run's row runs for 1.8s; the PR sweep waits for
// it so only one moving gradient is ever on screen.
const SWEEP_DELAY_MS = 1900
const SWEEP_MS = 1700

export default function RunningPRs() {
  const { runLogs } = useUser()
  const [prs, setPrs] = useState<RunPR[]>([])
  const seen = useRef<Map<string, RunPR> | null>(null)
  const [newPr, setNewPr] = useState<string | null>(null)
  const [sweep, setSweep] = useState<string | null>(null)

  // Refetch when the context's runs change — a new run can set a PB, and a
  // deleted one can retire it.
  useEffect(() => {
    let cancelled = false
    getRunPRs()
      .then(d => {
        if (cancelled) return
        const before = seen.current
        seen.current = new Map(d.prs.map(p => [p.label, p]))
        setPrs(d.prs)
        if (!before) return // first load: an old record is not news
        // New only if it's a fresh category or a newer record; a deletion
        // falls back to an older run, which must not celebrate.
        const fresh = d.prs.find(p => {
          const old = before.get(p.label)
          return !old || (old.value !== p.value && p.date >= old.date)
        })
        if (fresh) setNewPr(fresh.label)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [runLogs])

  useEffect(() => {
    if (!newPr) return
    const start = setTimeout(() => setSweep(newPr), SWEEP_DELAY_MS)
    const end = setTimeout(() => { setSweep(null); setNewPr(null) }, SWEEP_DELAY_MS + SWEEP_MS)
    return () => { clearTimeout(start); clearTimeout(end) }
  }, [newPr])

  if (prs.length === 0) return null

  return (
    <SummaryCard title="Personal bests">
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {prs.map((pr, i) => (
          <li
            key={pr.label}
            style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
              padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, color: 'var(--ink)' }}>{sentenceCase(pr.label)}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>{formatPrDate(pr.date)}</span>
            </span>
            <span style={{ flexShrink: 0, textAlign: 'right' }}>
              <span
                className={sweep === pr.label ? 'gradient-sweep' : undefined}
                style={{ display: 'inline-block', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}
              >
                {pr.value}
              </span>
              {pr.detail && (
                <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>{pr.detail}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </SummaryCard>
  )
}
