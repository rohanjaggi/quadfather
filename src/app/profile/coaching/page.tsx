'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { updateCoachingPrefs } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import type { CoachingPrefs } from '@/types/api'

const DEFAULT_PREFS: CoachingPrefs = {
  daily_coach: true,
  weekly_insights: true,
  nudge_inactivity: true,
  nudge_recovery: true,
  nudge_nutrition_gap: true,
  nudge_steps: true,
  nudge_consistency: true,
  pre_workout_suggestions: true,
  workout_analysis: true,
  weekly_exercise_digest: true,
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
  {
    label: 'Exercise Coaching',
    features: [
      { key: 'pre_workout_suggestions' as const, title: 'Pre-Workout Tips', desc: 'Show weight/rep suggestions when logging' },
      { key: 'workout_analysis' as const, title: 'Post-Workout Analysis', desc: 'AI analysis after each workout' },
      { key: 'weekly_exercise_digest' as const, title: 'Weekly Digest', desc: 'Training summary & stall alerts every week' },
    ],
  },
]

/**
 * The stored JSON is free-form and predates three of the toggles, so a saved
 * object is merged *over* the defaults rather than replacing them — otherwise a
 * user who saved before the exercise group shipped sees those three read as
 * `undefined` and render as off.
 */
function withDefaults(stored: Partial<CoachingPrefs> | undefined): CoachingPrefs {
  return { ...DEFAULT_PREFS, ...stored }
}

function Toggle({ enabled, onChange, disabled, label }: {
  enabled: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
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
  const { user, refreshUser } = useUser()

  const [masterEnabled, setMasterEnabled] = useState(user?.ai_features_enabled ?? false)
  const [prefs, setPrefs] = useState<CoachingPrefs>(withDefaults(user?.ai_coaching_prefs))
  const [saveError, setSaveError] = useState<string | null>(null)
  // One save at a time. Each handler PUTs the whole prefs object and then
  // refreshes the user (which feeds the effect below back into `prefs`), so
  // overlapping taps would both clobber each other and land out of order.
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) {
      setMasterEnabled(user.ai_features_enabled)
      setPrefs(withDefaults(user.ai_coaching_prefs))
    }
  }, [user])

  /**
   * Saves one change, then pulls the user back down so navigating away and
   * returning doesn't revert to the stale context copy. The revert only applies
   * to a failed PUT — if the PUT landed and only the refresh failed, the
   * optimistic value is the truth and undoing it would be a lie.
   */
  async function save(put: () => Promise<unknown>, revert: () => void) {
    setSaveError(null)
    setBusy(true)
    try {
      await put()
    } catch (err) {
      revert()
      setSaveError(errorMessage(err, 'Failed to save preference'))
      setBusy(false)
      return
    }
    try {
      await refreshUser()
    } catch (err) {
      setSaveError(`Saved, but couldn't reload your settings — ${errorMessage(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleMasterToggle() {
    if (busy) return
    const previous = masterEnabled
    const newVal = !previous
    setMasterEnabled(newVal)
    await save(
      () => updateCoachingPrefs({ ai_features_enabled: newVal }),
      () => setMasterEnabled(previous),
    )
  }

  async function handleFeatureToggle(key: keyof CoachingPrefs) {
    if (busy) return
    const previous = prefs
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    await save(
      () => updateCoachingPrefs({ ai_coaching_prefs: updated }),
      () => setPrefs(previous),
    )
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

      {saveError && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          color: 'var(--accent-calories)', padding: '10px 14px',
          backgroundColor: 'oklch(0.94 0.02 30)',
          borderRadius: '10px',
        }}>
          {saveError}
        </p>
      )}

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
        <Toggle
          enabled={masterEnabled}
          onChange={handleMasterToggle}
          disabled={busy}
          label="Enable AI Coaching"
        />
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
                  disabled={!masterEnabled || busy}
                  label={f.title}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}
