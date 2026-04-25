'use client'

import { useState, useEffect, FormEvent } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { useUser } from '@/context/UserContext'
import { setApiKey, deleteApiKey } from '@/lib/api'

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
] as const

export default function ProfilePage() {
  const { user, updateGoals, refresh } = useUser()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    daily_calorie_goal: '',
    daily_protein_goal: '',
    daily_water_goal: '',
    water_bottle_size: '',
  })

  const [keyProvider, setKeyProvider] = useState('openai')
  const [keyValue, setKeyValue] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saved' | 'removed' | 'error'>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setForm({
        daily_calorie_goal: String(user.goals.daily_calorie_goal),
        daily_protein_goal: String(user.goals.daily_protein_goal),
        daily_water_goal: String(user.goals.daily_water_goal),
        water_bottle_size: String(user.water_bottle_size),
      })
      if (user.ai_provider) setKeyProvider(user.ai_provider)
    }
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateGoals({
        daily_calorie_goal: parseFloat(form.daily_calorie_goal),
        daily_protein_goal: parseFloat(form.daily_protein_goal),
        daily_water_goal: parseFloat(form.daily_water_goal),
        water_bottle_size: parseFloat(form.water_bottle_size),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveKey(e: FormEvent) {
    e.preventDefault()
    if (!keyValue.trim()) return
    setKeySaving(true)
    setKeyError(null)
    setKeyStatus('idle')
    try {
      await setApiKey({ provider: keyProvider, api_key: keyValue.trim() })
      setKeyValue('')
      setKeyStatus('saved')
      await refresh()
      setTimeout(() => setKeyStatus('idle'), 2000)
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to save key')
      setKeyStatus('error')
    } finally {
      setKeySaving(false)
    }
  }

  async function handleRemoveKey() {
    setKeySaving(true)
    setKeyError(null)
    setKeyStatus('idle')
    try {
      await deleteApiKey()
      setKeyStatus('removed')
      await refresh()
      setTimeout(() => setKeyStatus('idle'), 2000)
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to remove key')
      setKeyStatus('error')
    } finally {
      setKeySaving(false)
    }
  }

  const fields = [
    { key: 'daily_calorie_goal', label: 'Daily Calories', unit: 'kcal', step: '50' },
    { key: 'daily_protein_goal', label: 'Daily Protein', unit: 'g', step: '5' },
    { key: 'daily_water_goal', label: 'Daily Water', unit: 'L', step: '0.5' },
    { key: 'water_bottle_size', label: 'Bottle Size', unit: 'L', step: '0.1' },
  ]

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--tg-theme-text-color)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Header */}
      <div className="fade-up">
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '5px',
        }}>
          Settings
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '36px',
          fontWeight: 400,
          lineHeight: 1.1,
          color: 'var(--tg-theme-text-color)',
        }}>
          Your Goals
        </h1>
      </div>

      <div className="fade-up fade-up-1">
        <SummaryCard title="Daily Targets">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {fields.map(({ key, label, unit, step }) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <label style={labelStyle}>{label}</label>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--tg-theme-hint-color)',
                    letterSpacing: '0.04em',
                  }}>
                    {unit}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step={step}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required
                  className="input-field"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{
                backgroundColor: saved ? 'var(--accent-protein)' : undefined,
                marginTop: '4px',
              }}
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Goals'}
            </button>
          </form>
        </SummaryCard>
      </div>

      {/* AI Provider */}
      <div className="fade-up fade-up-2">
        <SummaryCard title="AI Provider">
          <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: user?.has_api_key ? 'var(--accent-protein)' : 'var(--tg-theme-hint-color)',
              }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
                {user?.has_api_key
                  ? `${PROVIDERS.find(p => p.value === user.ai_provider)?.label ?? user.ai_provider} key active`
                  : 'No API key set — AI features are disabled'}
              </span>
            </div>

            {/* Provider selector */}
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: '7px' }}>Provider</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setKeyProvider(p.value)}
                    className="btn-pill"
                    data-active={keyProvider === p.value ? 'true' : undefined}
                    style={{ flex: 1 }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* API key input */}
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: '7px' }}>API Key</label>
              <input
                type="password"
                value={keyValue}
                onChange={e => setKeyValue(e.target.value)}
                placeholder={user?.has_api_key ? '••••••••••••••••' : 'Paste your API key'}
                className="input-field"
              />
            </div>

            {keyError && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--accent-calories)' }}>
                {keyError}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {user?.has_api_key && (
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  disabled={keySaving}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    color: 'var(--accent-calories)',
                  }}
                >
                  {keyStatus === 'removed' ? 'Removed' : 'Remove Key'}
                </button>
              )}
              <button
                type="submit"
                disabled={keySaving || !keyValue.trim()}
                className="btn-primary"
                style={{
                  flex: 2,
                  backgroundColor: keyStatus === 'saved' ? 'var(--accent-protein)' : undefined,
                }}
              >
                {keySaving ? 'Saving…' : keyStatus === 'saved' ? 'Saved ✓' : 'Save Key'}
              </button>
            </div>
          </form>
        </SummaryCard>
      </div>

    </div>
  )
}
