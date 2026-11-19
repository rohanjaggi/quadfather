'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/context/UserContext'
import { getAccessTokenStatus } from '@/lib/api'
import { PROVIDER_MODELS, DEFAULT_MODELS, type AIProvider } from '@/lib/models'
import { formatInt } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import { FoodIcon, KeyIcon, LinkIcon, MessageIcon, StepsIcon, TargetIcon, UserIcon, WaterIcon } from '@/components/ui/icons'
import { SettingsGroup, SettingsLink } from '@/components/settings/ui'
import { dietSummary } from '@/components/settings/diet'

function modelLabel(provider: string, model: string | null | undefined): string {
  const id = model || DEFAULT_MODELS[provider as AIProvider]
  return PROVIDER_MODELS[provider as AIProvider]?.find(m => m.id === id)?.label ?? id ?? 'Custom model'
}

export default function SettingsPage() {
  const { user } = useUser()
  // Shown as the Steps sync value; unknown (blank) until it answers.
  const [stepsToken, setStepsToken] = useState<boolean | null>(null)

  useEffect(() => {
    getAccessTokenStatus().then(({ has_token }) => setStepsToken(has_token)).catch(() => {})
  }, [])

  if (!user) return null

  const name = user.first_name || user.username || 'You'
  const strava = !user.strava_connected ? 'Not connected' : user.strava_scope_ok === false ? 'Needs access' : 'Connected'

  return (
    <div>
      <PageHeader title="Settings" back={{ href: '/', label: 'Today' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <section className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            aria-hidden="true"
            style={{
              width: 48, height: 48, borderRadius: 24, flexShrink: 0, display: 'grid', placeItems: 'center',
              // Not tappable here, so neutral: green only ever means "tap me".
              background: 'var(--track)', color: 'var(--ink)', fontSize: 20, fontWeight: 700,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>{name}</p>
            {user.username && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>@{user.username}</p>}
          </div>
        </section>

        <SettingsGroup title="Goals and body">
          <SettingsLink href="/profile/goals" icon={<TargetIcon />} label="Daily goals"
            value={`${formatInt(user.goals.daily_calorie_goal)} kcal`} />
          <SettingsLink href="/profile/personal" icon={<UserIcon />} label="Personal details"
            value={user.personal ? `${user.personal.weight_kg} kg` : 'Not set'} />
          <SettingsLink href="/profile/personal#diet" icon={<FoodIcon />} label="Dietary needs"
            value={dietSummary(user.dietary_restrictions ?? [])} />
          <SettingsLink href="/profile/goals#water" icon={<WaterIcon />} label="Water bottle"
            value={`${user.water_bottle_size} L`} />
        </SettingsGroup>

        <SettingsGroup title="Coaching">
          <SettingsLink href="/profile/coaching" icon={<MessageIcon />} label="Daily coach"
            value={user.ai_features_enabled ? 'On' : 'Off'} />
          <SettingsLink href="/profile/api-key" icon={<KeyIcon />} label="AI model and key"
            value={user.ai_provider ? modelLabel(user.ai_provider, user.ai_model) : 'No key'} />
        </SettingsGroup>

        <SettingsGroup title="Connections">
          <SettingsLink href="/profile/strava" icon={<LinkIcon />} label="Strava" value={strava} />
          <SettingsLink href="/profile/steps-sync" icon={<StepsIcon />} label="Steps sync"
            value={stepsToken == null ? undefined : stepsToken ? 'Set up' : 'Not set up'} />
        </SettingsGroup>
      </div>
    </div>
  )
}
