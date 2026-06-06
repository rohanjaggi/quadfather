'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'

interface CoachingPrefs {
  daily_coach: boolean
  weekly_insights: boolean
  nudge_inactivity: boolean
  nudge_recovery: boolean
  nudge_nutrition_gap: boolean
  nudge_steps: boolean
  nudge_consistency: boolean
}

const DEFAULT_PREFS: CoachingPrefs = {
  daily_coach: true,
  weekly_insights: true,
  nudge_inactivity: true,
  nudge_recovery: true,
  nudge_nutrition_gap: true,
  nudge_steps: true,
  nudge_consistency: true,
}

const FEATURE_GROUPS = [
  {
    label: 'Daily Messages',
    features: [
      { key: 'daily_coach' as const, title: 'Daily Coach', desc: 'Personalized nutrition coaching each evening' },
      { key: 'weekly_insights' as const, title: 'Weekly Insights', desc: '7-day pattern analysis every week' },
    ],
  },
  {
    label: 'Proactive Nudges',
    features: [
      { key: 'nudge_inactivity' as const, title: 'Inactivity', desc: 'Remind when no workout in 5+ days' },
      { key: 'nudge_recovery' as const, title: 'Recovery', desc: 'Warn when training too hard' },
      { key: 'nudge_nutrition_gap' as const, title: 'Nutrition Gap', desc: 'Alert when exercise is high but intake is low' },
      { key: 'nudge_steps' as const, title: 'Steps', desc: 'Nudge when steps are below goal' },
      { key: 'nudge_consistency' as const, title: 'Consistency', desc: 'Celebrate workout consistency streaks' },
    ],
  },
]

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      style={{
        width: '44px', height: '26px', borderRadius: '13px',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: enabled ? 'var(--tg-theme-button-color)' : 'var(--surface-border)',
        position: 'relative',
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%',
        backgroundColor: 'var(--tg-theme-bg-color)',
        position: 'absolute', top: '3px',
        left: enabled ? '21px' : '3px',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }} />
    </button>
  )
}

export default function CoachingPage() {
  const { user } = useUser()

  const [masterEnabled, setMasterEnabled] = useState(user?.ai_features_enabled ?? false)
  const [prefs, setPrefs] = useState<CoachingPrefs>(user?.ai_coaching_prefs ?? DEFAULT_PREFS)

  useEffect(() => {
    if (user) {
      setMasterEnabled(user.ai_features_enabled)
      setPrefs(user.ai_coaching_prefs ?? DEFAULT_PREFS)
    }
  }, [user])

  async function save(updates: { ai_features_enabled?: boolean; ai_coaching_prefs?: CoachingPrefs }) {
    await fetch('/api/users/me/goals', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': window.Telegram?.WebApp?.initData ?? '',
      },
      body: JSON.stringify(updates),
    })
  }

  function handleMasterToggle() {
    const newVal = !masterEnabled
    setMasterEnabled(newVal)
    save({ ai_features_enabled: newVal })
  }

  function handleFeatureToggle(key: keyof CoachingPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    save({ ai_coaching_prefs: updated })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div className="fade-up">
        <Link href="/profile" style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Settings
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
          lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>
          AI Coaching
        </h1>
      </div>

      {/* Master toggle */}
      <div className="fade-up fade-up-1" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderRadius: '16px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
      }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '15px',
            fontWeight: 600, color: 'var(--tg-theme-text-color)',
          }}>
            Enable AI Coaching
          </p>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            color: 'var(--tg-theme-hint-color)', marginTop: '2px',
          }}>
            Receive coaching via Telegram messages
          </p>
        </div>
        <Toggle enabled={masterEnabled} onChange={handleMasterToggle} />
      </div>

      {/* Feature groups */}
      {FEATURE_GROUPS.map((group, gi) => (
        <div key={group.label} className={`fade-up fade-up-${gi + 2}`} style={{
          opacity: masterEnabled ? 1 : 0.45,
          transition: 'opacity 0.3s ease',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)', marginBottom: '10px',
          }}>
            {group.label}
          </p>
          <div style={{
            borderRadius: '16px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            overflow: 'hidden',
          }}>
            {group.features.map((f, fi) => (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px',
                borderTop: fi === 0 ? 'none' : '1px solid var(--surface-border)',
              }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '14px',
                    fontWeight: 500, color: 'var(--tg-theme-text-color)',
                  }}>
                    {f.title}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: '11px',
                    color: 'var(--tg-theme-hint-color)', marginTop: '2px',
                  }}>
                    {f.desc}
                  </p>
                </div>
                <Toggle
                  enabled={prefs[f.key]}
                  onChange={() => handleFeatureToggle(f.key)}
                  disabled={!masterEnabled}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}
