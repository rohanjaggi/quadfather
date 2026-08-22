'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { setApiKey, deleteApiKey } from '@/lib/api'
import { PROVIDER_MODELS, DEFAULT_MODELS, type AIProvider } from '@/lib/models'
import { errorMessage } from '@/lib/errors'

const PROVIDERS: { value: AIProvider; label: string; shortLabel: string }[] = [
  { value: 'gemini', label: 'Google Gemini', shortLabel: 'Google' },
  { value: 'openai', label: 'OpenAI', shortLabel: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic', shortLabel: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter', shortLabel: 'OpenRouter' },
]

export default function ApiKeyPage() {
  const { user, refreshUser } = useUser()
  const [keyProvider, setKeyProvider] = useState<AIProvider>('gemini')
  const [selectedModel, setSelectedModel] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saved' | 'removed' | 'error'>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.ai_provider) {
      const provider = user.ai_provider as AIProvider
      setKeyProvider(provider)
      if (user.ai_model) {
        const models = PROVIDER_MODELS[provider]
        const isPreset = models.some(m => m.id === user.ai_model)
        if (isPreset) {
          setSelectedModel(user.ai_model)
          setCustomModel('')
        } else {
          setSelectedModel('custom')
          setCustomModel(user.ai_model)
        }
      } else {
        setSelectedModel(DEFAULT_MODELS[provider])
      }
    }
  }, [user])

  function handleProviderChange(provider: AIProvider) {
    setKeyProvider(provider)
    setSelectedModel(DEFAULT_MODELS[provider])
    setCustomModel('')
  }

  const resolvedModel = selectedModel === 'custom' ? customModel.trim() : selectedModel

  async function handleSaveKey(e: FormEvent) {
    e.preventDefault()
    if (!keyValue.trim()) return
    setKeySaving(true)
    setKeyError(null)
    setKeyStatus('idle')
    try {
      await setApiKey({
        provider: keyProvider,
        api_key: keyValue.trim(),
        model: resolvedModel || undefined,
      })
      setKeyValue('')
      setKeyStatus('saved')
      await refreshUser()
      setTimeout(() => setKeyStatus('idle'), 2000)
    } catch (err) {
      setKeyError(errorMessage(err, 'Failed to save key'))
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
      await refreshUser()
      setTimeout(() => setKeyStatus('idle'), 2000)
    } catch (err) {
      setKeyError(errorMessage(err, 'Failed to remove key'))
      setKeyStatus('error')
    } finally {
      setKeySaving(false)
    }
  }

  const models = PROVIDER_MODELS[keyProvider]
  const activeProviderLabel = PROVIDERS.find(p => p.value === keyProvider)?.label

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div className="fade-up">
        <Link href="/profile" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Settings
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px',
          fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>
          AI Provider
        </h1>
      </div>

      {/* Status */}
      <div className="fade-up fade-up-1" style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 16px',
        borderRadius: '14px',
        backgroundColor: user?.has_api_key
          ? 'oklch(0.92 0.02 155)'
          : 'var(--tg-theme-secondary-bg-color)',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          backgroundColor: user?.has_api_key
            ? 'var(--accent-protein)'
            : 'var(--tg-theme-hint-color)',
        }} />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: user?.has_api_key
            ? 'oklch(0.35 0.04 155)'
            : 'var(--tg-theme-hint-color)',
          fontWeight: user?.has_api_key ? 500 : 400,
        }}>
          {user?.has_api_key
            ? `${PROVIDERS.find(p => p.value === user.ai_provider)?.label ?? user.ai_provider} connected`
            : 'No API key configured'}
        </span>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSaveKey}
        className="fade-up fade-up-2"
        style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
      >

        {/* Provider selector */}
        <div>
          <label style={{
            fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            color: 'var(--tg-theme-hint-color)', display: 'block', marginBottom: '10px',
          }}>
            Provider
          </label>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
          }}>
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleProviderChange(p.value)}
                style={{
                  padding: '14px 12px',
                  borderRadius: '14px',
                  border: keyProvider === p.value
                    ? '1.5px solid var(--tg-theme-button-color)'
                    : '1px solid var(--surface-border)',
                  backgroundColor: keyProvider === p.value
                    ? 'oklch(0.95 0.01 170)'
                    : 'transparent',
                  color: keyProvider === p.value
                    ? 'var(--tg-theme-button-color)'
                    : 'var(--tg-theme-text-color)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: keyProvider === p.value ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center' as const,
                }}
              >
                {p.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Model selector */}
        <div>
          <label style={{
            fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            color: 'var(--tg-theme-hint-color)', display: 'block', marginBottom: '10px',
          }}>
            Model
          </label>
          {keyProvider === 'openrouter' ? (
            <>
              <select
                value={selectedModel}
                onChange={e => { setSelectedModel(e.target.value); setCustomModel('') }}
                className="input-field-bordered"
                style={{ appearance: 'none', paddingRight: '36px', cursor: 'pointer' }}
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.description}
                  </option>
                ))}
                <option value="custom">Custom model ID</option>
              </select>
              {selectedModel === 'custom' && (
                <input
                  type="text"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  placeholder="e.g. meta-llama/llama-4-scout"
                  className="input-field-bordered"
                  style={{ marginTop: '10px' }}
                />
              )}
            </>
          ) : (
            <div className="option-group">
              {models.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setSelectedModel(m.id); setCustomModel('') }}
                  className="option-group-item"
                  data-active={selectedModel === m.id ? 'true' : undefined}
                >
                  <span>{m.label}</span>
                  <span style={{ fontSize: '11px', opacity: 0.55, fontWeight: 400 }}>{m.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* API key input */}
        <div>
          <label style={{
            fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            color: 'var(--tg-theme-hint-color)', display: 'block', marginBottom: '10px',
          }}>
            API Key
          </label>
          <input
            type="password"
            value={keyValue}
            onChange={e => setKeyValue(e.target.value)}
            placeholder={user?.has_api_key ? '••••••••••••••••' : `Paste your ${activeProviderLabel} key`}
            className="input-field-bordered"
          />
          {user?.has_api_key && (
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)', marginTop: '6px',
              paddingLeft: '2px',
            }}>
              Enter a new key to replace the existing one
            </p>
          )}
        </div>

        {keyError && (
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            color: 'var(--accent-calories)', padding: '10px 14px',
            backgroundColor: 'oklch(0.94 0.02 30)',
            borderRadius: '10px',
          }}>
            {keyError}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {user?.has_api_key && (
            <button
              type="button"
              onClick={handleRemoveKey}
              disabled={keySaving}
              className="btn-secondary"
              style={{ flex: 1, color: 'var(--accent-calories)' }}
            >
              {keyStatus === 'removed' ? 'Removed' : 'Remove'}
            </button>
          )}
          <button
            type="submit"
            disabled={keySaving || !keyValue.trim()}
            className="btn-primary"
            style={{
              flex: user?.has_api_key ? 2 : 1,
              backgroundColor: keyStatus === 'saved' ? 'var(--accent-protein)' : undefined,
            }}
          >
            {keySaving ? 'Saving…' : keyStatus === 'saved' ? 'Saved' : 'Save Key'}
          </button>
        </div>

      </form>
    </div>
  )
}
