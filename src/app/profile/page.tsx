'use client'

import Link from 'next/link'
import { useUser } from '@/context/UserContext'

const PROFILE_SECTIONS = [
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
]

export default function SettingsPage() {
  const { user } = useUser()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)', marginBottom: '6px',
          }}>
            Profile
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '32px',
            fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em',
            color: 'var(--tg-theme-text-color)',
          }}>
            Settings
          </h1>
          {user?.username && (
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '14px',
              color: 'var(--tg-theme-hint-color)', marginTop: '6px',
            }}>
              @{user.username}
            </p>
          )}
        </div>
        <img
          src="/logo.png"
          alt="Quadfather"
          style={{ width: '64px', height: '64px', flexShrink: 0 }}
        />
      </div>

      {/* Profile & Goals */}
      <div className="fade-up fade-up-1">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
        }}>
          Profile & Goals
        </p>
        <div style={{
          display: 'flex', flexDirection: 'column',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          overflow: 'hidden',
        }}>
          {PROFILE_SECTIONS.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '16px 18px',
                textDecoration: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--surface-border)',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '10px',
                backgroundColor: 'var(--tg-theme-bg-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--tg-theme-hint-color)', flexShrink: 0,
              }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '15px',
                  fontWeight: 500, color: 'var(--tg-theme-text-color)',
                }}>
                  {s.title}
                </p>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: '12px',
                  color: 'var(--tg-theme-hint-color)', marginTop: '2px',
                }}>
                  {s.description}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--tg-theme-hint-color)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="fade-up fade-up-2">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
        }}>
          AI Provider
        </p>
        <Link
          href="/profile/api-key"
          style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '16px 18px',
            borderRadius: '16px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            textDecoration: 'none',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--tg-theme-hint-color)', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '15px',
              fontWeight: 500, color: 'var(--tg-theme-text-color)',
            }}>
              API Key
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '12px',
              color: 'var(--tg-theme-hint-color)', marginTop: '2px',
            }}>
              Manage your key for AI features
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--tg-theme-hint-color)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {/* Integrations */}
      <div className="fade-up fade-up-3">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
        }}>
          Integrations
        </p>
        <div style={{
          display: 'flex', flexDirection: 'column',
          borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          overflow: 'hidden',
        }}>
          <Link
            href="/profile/strava"
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px 18px', textDecoration: 'none',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '10px',
              backgroundColor: 'var(--tg-theme-bg-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--tg-theme-hint-color)', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '15px',
                fontWeight: 500, color: 'var(--tg-theme-text-color)',
              }}>
                Strava
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '12px',
                color: 'var(--tg-theme-hint-color)', marginTop: '2px',
              }}>
                Sync running activities from Strava
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--tg-theme-hint-color)" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
          <Link
            href="/profile/steps-sync"
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px 18px', textDecoration: 'none',
              borderTop: '1px solid var(--surface-border)',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '10px',
              backgroundColor: 'var(--tg-theme-bg-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--tg-theme-hint-color)', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '15px',
                fontWeight: 500, color: 'var(--tg-theme-text-color)',
              }}>
                Steps Sync
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '12px',
                color: 'var(--tg-theme-hint-color)', marginTop: '2px',
              }}>
                Auto-sync Apple Health steps via iOS Shortcut
              </p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--tg-theme-hint-color)" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Smart Coaching */}
      <div className="fade-up fade-up-4">
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
        }}>
          Smart Coaching
        </p>
        <Link
          href="/profile/coaching"
          style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '16px 18px',
            borderRadius: '16px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            textDecoration: 'none',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--tg-theme-hint-color)', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '15px',
              fontWeight: 500, color: 'var(--tg-theme-text-color)',
            }}>
              AI Coaching
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '12px',
              color: 'var(--tg-theme-hint-color)', marginTop: '2px',
            }}>
              Daily tips, weekly insights & nudges
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--tg-theme-hint-color)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.4 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

    </div>
  )
}
