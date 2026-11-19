'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useUser } from '@/context/UserContext'
import { setApiKey, deleteApiKey } from '@/lib/api'
import { PROVIDER_MODELS, DEFAULT_MODELS, type AIProvider } from '@/lib/models'
import { errorMessage } from '@/lib/errors'
import PageHeader from '@/components/ui/PageHeader'
import Sheet from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { ChevronRightIcon } from '@/components/ui/icons'
import { ChoiceList, ConfirmSheet, SaveBar } from '@/components/settings/ui'

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
]

const providerLabel = (p: string) => PROVIDERS.find(x => x.value === p)?.label ?? p

function modelName(provider: AIProvider, id: string): string {
  return PROVIDER_MODELS[provider]?.find(m => m.id === id)?.label ?? id
}

/** A row in the model card that opens a chooser sheet. */
function ChooserRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: 0,
        border: 'none', background: 'transparent', textAlign: 'left', color: 'var(--ink)', outlineOffset: -2,
      }}
    >
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{label}</span>
      <span style={{ maxWidth: '60%', fontSize: 15, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      <ChevronRightIcon size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </button>
  )
}

export default function ApiKeyPage() {
  const { user, refreshUser } = useUser()
  const hasOwnKey = !!user?.ai_provider
  const [keyProvider, setKeyProvider] = useState<AIProvider>('gemini')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS.gemini)
  const [customModel, setCustomModel] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'provider' | 'model' | 'remove' | null>(null)
  // Stable: Sheet re-runs its focus effect whenever onClose changes.
  const closeSheet = useCallback(() => setSheet(null), [])

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
    setSheet(null)
  }

  const resolvedModel = selectedModel === 'custom' ? customModel.trim() : selectedModel

  async function handleSaveKey(e: FormEvent) {
    e.preventDefault()
    if (!keyValue.trim() || keySaving) return
    setKeySaving(true)
    setKeyError(null)
    try {
      await setApiKey({
        provider: keyProvider,
        api_key: keyValue.trim(),
        model: resolvedModel || undefined,
      })
      setKeyValue('')
      toast('Key saved', { type: 'success' })
      await refreshUser()
    } catch (err) {
      setKeyError(errorMessage(err, "Couldn't save your key. Check it and try again."))
    } finally {
      setKeySaving(false)
    }
  }

  async function handleRemoveKey() {
    setKeySaving(true)
    setRemoveError(null)
    try {
      await deleteApiKey()
      await refreshUser()
      setSheet(null)
      toast('Key removed', { type: 'success' })
    } catch (err) {
      setRemoveError(errorMessage(err, "Couldn't remove your key. Try again."))
    } finally {
      setKeySaving(false)
    }
  }

  const models = PROVIDER_MODELS[keyProvider]
  const modelOptions = [
    ...models.map(m => ({ value: m.id, label: m.label, hint: m.description })),
    ...(keyProvider === 'openrouter' ? [{ value: 'custom', label: 'Custom model ID', hint: 'Any model OpenRouter offers' }] : []),
  ]
  const savedProvider = user?.ai_provider as AIProvider | undefined
  const savedModel = savedProvider ? modelName(savedProvider, user?.ai_model || DEFAULT_MODELS[savedProvider]) : ''

  return (
    <div>
      <PageHeader title="AI model and key" back={{ href: '/profile', label: 'Settings' }} />

      <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>
            {hasOwnKey ? `Using your ${providerLabel(user.ai_provider!)} key` : 'No key added'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--muted)' }}>
            {hasOwnKey
              ? `Model: ${savedModel}.`
              : 'Add a key from Google, OpenAI, Anthropic or OpenRouter to choose the model Quadfather uses.'}
          </p>
          {hasOwnKey && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setRemoveError(null); setSheet('remove') }}
              disabled={keySaving}
              style={{ marginTop: 8, marginLeft: -14, color: 'var(--over)' }}
            >
              Remove key
            </button>
          )}
        </section>

        <section className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <ChooserRow label="Provider" value={providerLabel(keyProvider)} onClick={() => setSheet('provider')} />
          <div aria-hidden="true" style={{ height: 1, background: 'var(--line)' }} />
          <ChooserRow
            label="Model"
            value={selectedModel === 'custom' ? (customModel.trim() || 'Custom') : modelName(keyProvider, selectedModel)}
            onClick={() => setSheet('model')}
          />
          {selectedModel === 'custom' && (
            <div style={{ padding: '4px 0 12px' }}>
              <label htmlFor="custom-model" className="label-caps">Model ID</label>
              <input
                id="custom-model"
                type="text"
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
                placeholder="e.g. meta-llama/llama-4-scout"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="input-field"
              />
            </div>
          )}
        </section>

        <section className="card">
          <label htmlFor="api-key" className="card-title" style={{ display: 'block', marginBottom: 10 }}>
            Your {providerLabel(keyProvider)} key
          </label>
          <input
            id="api-key"
            type="password"
            value={keyValue}
            onChange={e => setKeyValue(e.target.value)}
            placeholder={hasOwnKey ? '••••••••••••••••' : 'Paste your key'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby="api-key-hint"
            className="input-field"
          />
          <p id="api-key-hint" style={{ margin: '8px 2px 0', fontSize: 13, color: 'var(--muted)' }}>
            {hasOwnKey
              ? 'To change provider or model, paste your key again. '
              : ''}
            It’s stored encrypted and only used for your requests.
          </p>
        </section>

        <SaveBar dirty={!!keyValue.trim()} saving={keySaving} label="Save key" error={keyError} />
      </form>

      <Sheet open={sheet === 'provider'} onClose={closeSheet} title="Choose a provider">
        <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <ChoiceList label="Provider" options={PROVIDERS} value={keyProvider} onChange={handleProviderChange} />
        </section>
      </Sheet>

      <Sheet open={sheet === 'model'} onClose={closeSheet} title="Choose a model">
        <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <ChoiceList
            label="Model"
            options={modelOptions}
            value={selectedModel}
            onChange={id => { setSelectedModel(id); setCustomModel(''); setSheet(null) }}
          />
        </section>
      </Sheet>

      <ConfirmSheet
        open={sheet === 'remove'}
        onClose={closeSheet}
        title="Remove your key?"
        body={`Quadfather stops using your ${user?.ai_provider ? providerLabel(user.ai_provider) : ''} key. You can add one again any time.`}
        confirmLabel="Remove key"
        busyLabel="Removing…"
        busy={keySaving}
        error={removeError}
        onConfirm={handleRemoveKey}
      />

    </div>
  )
}
