'use client'

import Link from 'next/link'
import { useUser } from '@/context/UserContext'

const SECTIONS = [
  {
    href: '/profile/goals',
    title: 'Daily Goals',
    description: 'Calorie, protein, and macro targets',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    href: '/profile/personal',
    title: 'Personal Info',
    description: 'Weight, height, age & activity level',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: '/profile/api-key',
    title: 'AI Provider',
    description: 'Manage your API key for AI features',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
]

export default function SettingsPage() {
  const { user } = useUser()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="fade-up">
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '11px',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '5px',
        }}>
          Profile
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '36px',
          fontWeight: 400, lineHeight: 1.1, color: 'var(--tg-theme-text-color)',
        }}>
          Settings
        </h1>
        {user?.username && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '13px',
            color: 'var(--tg-theme-hint-color)', marginTop: '6px',
          }}>
            @{user.username}
          </p>
        )}
      </div>

      {SECTIONS.map((s, i) => (
        <Link
          key={s.href}
          href={s.href}
          className={`fade-up fade-up-${i + 1}`}
          style={{ textDecoration: 'none' }}
        >
          <div className="card" style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '12px',
              backgroundColor: 'var(--tg-theme-bg-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--tg-theme-hint-color)', flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '17px',
                fontWeight: 500, color: 'var(--tg-theme-text-color)',
                marginBottom: '2px',
              }}>
                {s.title}
              </p>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: '12px',
                color: 'var(--tg-theme-hint-color)',
              }}>
                {s.description}
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--tg-theme-hint-color)" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  )
}
