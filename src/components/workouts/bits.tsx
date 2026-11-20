'use client'

import type { CSSProperties } from 'react'
import { errorMessage, errorStatus } from '@/lib/errors'

/** `errorMessage` (which already hides raw server detail) plus an expired-session case. */
export function friendlyError(err: unknown, fallback: string): string {
  if (errorStatus(err) === 401) return 'Your session has expired. Close Quadfather and open it again from Telegram.'
  return errorMessage(err, fallback)
}

/** A card-title-row text link ("See all", "History"): green because it's tappable. */
export const linkStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-12px -8px -12px 0', padding: '0 8px',
  fontSize: 15, fontWeight: 600, color: 'var(--action)', textDecoration: 'none',
}

/** Quiet placeholder rows while a list loads. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ height: 14, width: `${58 - i * 9}%`, borderRadius: 7, background: 'var(--track)' }} />
          <span style={{ height: 14, width: 64, borderRadius: 7, background: 'var(--track)' }} />
        </div>
      ))}
    </div>
  )
}

/** Plain words plus the way back. `message` must already be `errorMessage(...)`. */
export function ErrorRetry({ message, onRetry, busy = false }: { message: string; onRetry: () => void; busy?: boolean }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 15, color: 'var(--ink)' }}>{message}</p>
      <button type="button" className="btn-secondary" onClick={onRetry} disabled={busy} style={{ flexShrink: 0 }}>
        {busy ? 'Trying…' : 'Retry'}
      </button>
    </div>
  )
}

/** The AI-working state: one shimmer block, never a spinner. */
export function AiWorking({ label, height = 56 }: { label: string; height?: number }) {
  return (
    <div role="status" aria-live="polite">
      <div className="ai-shimmer" style={{ height }} aria-hidden="true" />
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>{label}</p>
    </div>
  )
}
