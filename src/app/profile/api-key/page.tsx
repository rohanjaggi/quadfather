'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useUser } from '@/context/UserContext'
import { setApiKey, deleteApiKey } from '@/lib/api'
import { PROVIDER_MODELS, DEFAULT_MODELS, type AIProvider } from '@/lib/models'

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
]

export default function ApiKeyPage() {
  const { user, refresh } = useUser()
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

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--tg-theme-text-color)',
    display: 'block',
    marginBottom: '7px',
  }

  const models = PROVIDER_MODELS[keyProvider]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Back link */}
      <div className="fade-up">
        <Link href="/profile" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-body)', fontSize: '13px',
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
          fontWeight: 400, lineHeight: 1.1, color: 'var(--tg-theme-text-color)',
        }}>
          AI Provider
        </h1>
      </div>

      {/* Status indicator */}
      <div className="card fade-up fade-up-1">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: user?.has_api_key
              ? 'var(--accent-protein)'
              : 'var(--tg-theme-hint-color)',
          }} />
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: '13px',
            color: 'var(--tg-theme-hint-color)',
          }}>
            {user?.has_api_key
              ? `${PROVIDERS.find(p => p.value === user.ai_provider)?.label ?? user.ai_provider} key active`
              : 'No API key set — AI features are disabled'}
          </span>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSaveKey}
        className="fade-up fade-up-2"
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >

        {/* Provider selector */}
        <div>
          <label style={labelStyle}>Provider</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleProviderChange(p.value)}
                className="btn-pill"
                data-active={keyProvider === p.value ? 'true' : undefined}
                style={{ flex: 1 }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model selector */}
        <div>
          <label style={labelStyle}>Model</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {models.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setSelectedModel(m.id); setCustomModel('') }}
                className="btn-pill"
                data-active={selectedModel === m.id ? 'true' : undefined}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{m.label}</span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>{m.description}</span>
              </button>
            ))}
            {keyProvider === 'openrouter' && (
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedModel('custom')}
                  className="btn-pill"
                  data-active={selectedModel === 'custom' ? 'true' : undefined}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px' }}
                >
                  Custom Model
                </button>
                {selectedModel === 'custom' && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    placeholder="e.g. meta-llama/llama-4-scout"
                    className="input-field"
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* API key input */}
        <div>
          <label style={labelStyle}>API Key</label>
          <input
            type="password"
            value={keyValue}
            onChange={e => setKeyValue(e.target.value)}
            placeholder={user?.has_api_key ? '••••••••••••••••' : 'Paste your API key'}
            className="input-field"
          />
        </div>

        {keyError && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '12px',
            color: 'var(--accent-calories)',
          }}>
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
              style={{ flex: 1, color: 'var(--accent-calories)' }}
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
    </div>
  )
}
