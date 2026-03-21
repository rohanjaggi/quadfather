'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--tg-theme-hint-color)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function FoodIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--tg-theme-hint-color)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2s2-.9 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 2v3a4 4 0 01-4 4v13" />
    </svg>
  )
}

function WaterIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--tg-theme-hint-color)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </svg>
  )
}

function TrendsIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--tg-theme-hint-color)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--tg-theme-hint-color)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

const tabs = [
  { href: '/',          label: 'Today',     Icon: HomeIcon    },
  { href: '/food',      label: 'Nutrition', Icon: FoodIcon    },
  { href: '/water',     label: 'Water',     Icon: WaterIcon   },
  { href: '/analytics', label: 'Trends',    Icon: TrendsIcon  },
  { href: '/profile',   label: 'Goals',     Icon: ProfileIcon },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        backgroundColor: 'var(--tg-theme-bg-color)',
        borderTop: '1px solid var(--surface-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '10px 0 8px',
              gap: '4px',
              textDecoration: 'none',
            }}
          >
            <Icon active={isActive} />
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              fontWeight: isActive ? 500 : 400,
              letterSpacing: '0.03em',
              color: isActive ? 'var(--accent)' : 'var(--tg-theme-hint-color)',
            }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
