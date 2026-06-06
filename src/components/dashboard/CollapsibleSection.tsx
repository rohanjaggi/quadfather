'use client'

import { useState } from 'react'

export default function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="card">
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          marginBottom: open ? '18px' : 0,
          transition: 'margin-bottom 0.3s var(--ease-smooth)',
        }}
      >
        <span className="label-caps" style={{ letterSpacing: '0.09em', marginBottom: 0 }}>
          {title}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--tg-theme-hint-color)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s var(--ease-smooth)',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s var(--ease-smooth)',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
