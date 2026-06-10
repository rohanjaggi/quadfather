'use client'

import { useEffect, useState } from 'react'
import { getRunPRs } from '@/lib/api'
import type { RunPR } from '@/types/running'

export default function RunningPRs() {
  const [prs, setPrs] = useState<RunPR[]>([])

  useEffect(() => {
    getRunPRs().then(d => setPrs(d.prs)).catch(() => {})
  }, [])

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
                {pr.date}
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
