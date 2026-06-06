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

function RunIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--tg-theme-hint-color)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="4" r="2" />
      <path d="M15.59 13.51l-1.63-1.2-2.45 3.03-2.6-2.6-3.41 3.76" />
      <path d="M13.96 12.31l2.69-3.39-2.84-2.1-2.84 3.52" />
      <path d="M9.5 16.5L7 22" />
      <path d="M14 22l-1.5-5" />
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
  { href: '/',          label: 'Today',    Icon: HomeIcon    },
  { href: '/food',      label: 'Nutrition', Icon: FoodIcon    },
  { href: '/workouts',  label: 'Exercise',  Icon: RunIcon     },
  { href: '/analytics', label: 'Trends',    Icon: TrendsIcon  },
  { href: '/profile',   label: 'Settings',  Icon: ProfileIcon },
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
        background: 'rgba(245, 242, 239, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 -1px 12px rgba(28, 20, 16, 0.04)',
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
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              fontWeight: isActive ? 500 : 400,
              letterSpacing: '0.03em',
              color: isActive ? 'var(--accent)' : 'var(--tg-theme-hint-color)',
            }}>
              {label}
            </span>
            <div style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scale(1)' : 'scale(0)',
              transition: 'opacity 0.2s ease, transform 0.25s var(--ease-spring)',
            }} />
          </Link>
        )
      })}
    </nav>
  )
}
