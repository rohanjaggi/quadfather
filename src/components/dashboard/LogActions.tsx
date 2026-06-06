'use client'

import Link from 'next/link'

function MealIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2s2-.9 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 2v3a4 4 0 01-4 4v13" />
    </svg>
  )
}

function WaterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </svg>
  )
}

function RunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="4" r="2" />
      <path d="M15.59 13.51l-1.63-1.2-2.45 3.03-2.6-2.6-3.41 3.76" />
      <path d="M13.96 12.31l2.69-3.39-2.84-2.1-2.84 3.52" />
    </svg>
  )
}

export default function LogActions() {
  return (
    <div style={{ display: 'flex', gap: '10px', fontFamily: 'var(--font-display)' }}>
      <Link
        href="/food"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '18px 12px',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-button-color)',
          color: 'var(--tg-theme-button-text-color)',
          textDecoration: 'none',
          transition: 'opacity 0.2s ease, transform 0.15s var(--ease-spring)',
        }}
      >
        <MealIcon />
        <span style={{
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Meal
        </span>
      </Link>

      <Link
        href="/water"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '18px 12px',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          color: 'var(--tg-theme-text-color)',
          textDecoration: 'none',
          transition: 'opacity 0.2s ease, transform 0.15s var(--ease-spring)',
        }}
      >
        <WaterIcon />
        <span style={{
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Water
        </span>
      </Link>

      <Link
        href="/workouts"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          padding: '18px 12px',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          color: 'var(--tg-theme-text-color)',
          textDecoration: 'none',
          transition: 'opacity 0.2s ease, transform 0.15s var(--ease-spring)',
        }}
      >
        <RunIcon />
        <span style={{
          fontSize: '13px',
          fontWeight: 500,
        }}>
          Exercise
        </span>
      </Link>
    </div>
  )
}
