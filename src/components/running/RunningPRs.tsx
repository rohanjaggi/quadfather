'use client'

import { useEffect, useState } from 'react'
import { getRunPRs } from '@/lib/api'
import { useUser } from '@/context/UserContext'
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

export default function RunningPRs() {
  const { runLogs } = useUser()
  const [prs, setPrs] = useState<RunPR[]>([])

  // Refetch when the context's runs change — a new run can set a PB, and a
  // deleted one can retire it.
  useEffect(() => {
    let cancelled = false
    getRunPRs()
      .then(d => { if (!cancelled) setPrs(d.prs) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [runLogs])

  if (prs.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--tg-theme-hint-color)',
      }}>
        Personal Bests
      </p>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        overflow: 'hidden',
      }}>
        {prs.map((pr, i) => (
          <div
            key={pr.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: i < prs.length - 1 ? '1px solid var(--surface-border)' : 'none',
            }}
          >
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--tg-theme-text-color)',
                marginBottom: '2px',
              }}>
                {pr.label}
              </p>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                {formatPrDate(pr.date)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--accent-calories)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>
                {pr.value}
              </p>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                color: 'var(--tg-theme-hint-color)',
                marginTop: '2px',
              }}>
                {pr.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
