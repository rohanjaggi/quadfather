'use client'

import { Fragment, useState, useEffect } from 'react'
import { useUser } from '@/context/UserContext'
import { updateCoachingPrefs } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import type { CoachingPrefs } from '@/types/api'
import PageHeader from '@/components/ui/PageHeader'
import { toast } from '@/components/ui/Toast'

const DEFAULT_PREFS: CoachingPrefs = {
  daily_coach: true,
  weekly_insights: true,
  // Opt-in, matching `determineNudgeTopic`, which only sends a nudge on a stored `true`.
  nudge_inactivity: false,
  nudge_recovery: false,
  nudge_nutrition_gap: false,
  nudge_steps: false,
  nudge_consistency: false,
  pre_workout_suggestions: true,
  workout_analysis: true,
  weekly_exercise_digest: true,
}

const FEATURE_GROUPS: {
  label: string
  note?: string
  features: { key: keyof CoachingPrefs; title: string; desc: string }[]
}[] = [
  {
    label: 'Messages',
    features: [
      { key: 'daily_coach', title: 'Evening summary', desc: 'Your day at 9pm, with a quick way to add anything you forgot' },
      { key: 'weekly_insights', title: 'Weekly letter', desc: 'Monday morning: your week’s patterns and training' },
    ],
  },
  {
    label: 'Nudges',
    note: 'Off by default. Turn one on to get a line in your evening summary when it applies.',
    features: [
      { key: 'nudge_inactivity', title: 'No recent workout', desc: 'When you haven’t trained in 5 days' },
      { key: 'nudge_recovery', title: 'Recovery', desc: 'When you’re training too hard' },
      { key: 'nudge_nutrition_gap', title: 'Eating enough', desc: 'When you train a lot but eat too little' },
      { key: 'nudge_steps', title: 'Steps', desc: 'When your steps are behind your goal' },
      { key: 'nudge_consistency', title: 'Streaks', desc: 'Celebrates a run of steady workouts' },
    ],
  },
  {
    label: 'Training',
    features: [
      { key: 'pre_workout_suggestions', title: 'Set suggestions', desc: 'Weight and rep ideas while you log' },
    ],
  },
]

/**
 * The stored JSON is free-form and may lack newer keys, so a saved object is
 * merged *over* the defaults rather than replacing them: a missing key shows its
 * default, not `undefined` (which would render as off).
 */
function withDefaults(stored: Partial<CoachingPrefs> | undefined): CoachingPrefs {
  return { ...DEFAULT_PREFS, ...stored }
}

/**
 * A whole settings row that is one switch: big target, name, and what it does.
 * `inactive` (master switch off) draws it neutral off and blocks taps, while
 * the saved `on` value stays untouched for when the master comes back on.
 */
function SwitchRow({ on: saved, onToggle, disabled, inactive = false, title, desc }: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
  inactive?: boolean
  title: string
  desc: string
}) {
  const on = saved && !inactive
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={inactive || undefined}
      onClick={inactive ? undefined : onToggle}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 60,
        padding: '10px 0', border: 'none', background: 'transparent', textAlign: 'left',
        color: 'var(--ink)', outlineOffset: -2,
        cursor: disabled || inactive ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{title}</span>
        <span style={{ display: 'block', marginTop: 1, fontSize: 13, color: 'var(--muted)' }}>{desc}</span>
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'relative', width: 46, height: 28, borderRadius: 14, flexShrink: 0,
          background: on ? 'var(--action)' : inactive ? 'var(--track)' : 'var(--line-strong)',
          transition: 'background-color 0.2s ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 11,
          background: '#FFFFFF', boxShadow: '0 1px 3px rgba(31, 42, 36, 0.2)',
          transition: 'left 0.2s var(--ease-out-expo)',
        }} />
      </span>
    </button>
  )
}

const divider = <div aria-hidden="true" style={{ height: 1, background: 'var(--line)' }} />

export default function CoachingPage() {
  const { user, refreshUser } = useUser()

  const [masterEnabled, setMasterEnabled] = useState(user?.ai_features_enabled ?? false)
  const [prefs, setPrefs] = useState<CoachingPrefs>(withDefaults(user?.ai_coaching_prefs))
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
    setBusy(true)
    try {
      await put()
    } catch (err) {
      revert()
      // A toast, not an inline line: the row may be far below any banner.
      toast(errorMessage(err, "Couldn't save that change. Try again."))
      setBusy(false)
      return
    }
    try {
      await refreshUser()
    } catch (err) {
      toast(`Saved, but couldn't reload your settings. ${errorMessage(err)}`)
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
    <div>
      <PageHeader
        title="Daily coach"
        subtitle="Check-ins sent to your Telegram chat."
        back={{ href: '/profile', label: 'Settings' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <SwitchRow
            on={masterEnabled}
            onToggle={handleMasterToggle}
            disabled={busy}
            title="Coaching"
            desc={masterEnabled ? 'On. Choose what you get below.' : 'Off. Nothing is sent.'}
          />
        </section>

        {FEATURE_GROUPS.map(group => (
          <section
            key={group.label}
            className="card"
            style={{ paddingBottom: 8, opacity: masterEnabled ? 1 : 0.5, transition: 'opacity 0.3s ease' }}
          >
            <h2 className="card-title" style={{ margin: '0 0 2px' }}>{group.label}</h2>
            {group.note && (
              <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--muted)' }}>{group.note}</p>
            )}
            {group.features.map((f, i) => (
              <Fragment key={f.key}>
                {i > 0 && divider}
                <SwitchRow
                  on={prefs[f.key]}
                  onToggle={() => handleFeatureToggle(f.key)}
                  disabled={busy}
                  inactive={!masterEnabled}
                  title={f.title}
                  desc={f.desc}
                />
              </Fragment>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
