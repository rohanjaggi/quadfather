'use client'

import Link from 'next/link'

function MealIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2s2-.9 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 2v3a4 4 0 01-4 4v13" />
    </svg>
  )
}

function WaterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </svg>
  )
}

export default function LogActions() {
  return (
    <div className="card">
      <p className="label-caps" style={{ letterSpacing: '0.1em', marginBottom: '14px' }}>
        Log
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Link
          href="/food"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '16px',
            borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-button-color)',
            color: 'var(--tg-theme-button-text-color)',
            textDecoration: 'none',
            transition: 'opacity 0.2s ease, transform 0.15s var(--ease-spring)',
          }}
        >
          <MealIcon />
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            Meal
          </span>
        </Link>

        <Link
          href="/water"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '16px',
            borderRadius: '14px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            color: 'var(--tg-theme-text-color)',
            textDecoration: 'none',
            border: '1px solid var(--surface-border)',
            transition: 'opacity 0.2s ease, transform 0.15s var(--ease-spring)',
          }}
        >
          <WaterIcon />
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            Water
          </span>
        </Link>
      </div>
    </div>
  )
}
