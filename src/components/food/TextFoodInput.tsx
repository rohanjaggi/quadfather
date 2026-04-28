'use client'

import { useState } from 'react'
import { parseFood } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/TelegramProvider'
import type { MealAnalysis } from '@/types/api'

type Phase = 'idle' | 'analysing' | 'result' | 'logging' | 'saving'

export default function TextFoodInput({ onClose }: { onClose: () => void }) {
  const { user, logFood, saveFood } = useUser()
  const haptic = useHaptic()

  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MealAnalysis | null>(null)
  const [edited, setEdited] = useState<Partial<MealAnalysis>>({})
  const [savedConfirm, setSavedConfirm] = useState(false)

  async function handleAnalyse() {
    if (!text.trim()) return
    setPhase('analysing')
    setError(null)
    try {
      const data = await parseFood(text.trim())
      setResult(data)
      setEdited({})
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setPhase('idle')
    }
  }

  async function handleLog() {
    if (!result) return
    setPhase('logging')
    const merged = { ...result, ...edited }
    await logFood({
      food_name: merged.food_name ?? result.food_name,
      calories: Number(merged.calories ?? result.calories),
      protein: Number(merged.protein ?? result.protein),
      carbohydrates: Number(merged.carbohydrates ?? result.carbohydrates),
      fats: Number(merged.fats ?? result.fats),
      fiber: Number(merged.fiber ?? result.fiber),
      source: 'ai-text',
    })
    haptic.notification('success')
    onClose()
  }

  async function handleSaveFavourite() {
    if (!result) return
    setPhase('saving')
    setError(null)
    const merged = { ...result, ...edited }
    try {
      await saveFood({
        name: merged.food_name ?? result.food_name,
        calories: Number(merged.calories ?? result.calories),
        protein: Number(merged.protein ?? result.protein),
        carbohydrates: Number(merged.carbohydrates ?? result.carbohydrates),
        fats: Number(merged.fats ?? result.fats),
        fiber: Number(merged.fiber ?? result.fiber),
        description: result.notes || undefined,
        source: 'ai-text',
      })
      setSavedConfirm(true)
      setPhase('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save'
      setError(msg.includes('409') ? 'A favourite with this name already exists' : msg)
      setPhase('result')
    }
  }

  function reset() {
    setText('')
    setPhase('idle')
    setResult(null)
    setError(null)
    setEdited({})
    setSavedConfirm(false)
  }

  if (phase === 'result' || phase === 'logging' || phase === 'saving') {
    if (!result) return null
    const val = (key: keyof MealAnalysis) =>
      edited[key] !== undefined ? String(edited[key]) : String(result[key])

    const confidenceColor =
      result.confidence === 'high' ? 'var(--accent-protein)'
      : result.confidence === 'low' ? 'var(--accent-calories)'
      : 'var(--tg-theme-hint-color)'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: confidenceColor }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
            {result.confidence} confidence — {result.notes}
          </span>
        </div>

        <div>
          <label className="label-caps">Food name</label>
          <input
            className="input-field"
            value={val('food_name')}
            onChange={e => setEdited(d => ({ ...d, food_name: e.target.value }))}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {([
            { key: 'calories', label: 'Calories', unit: 'kcal' },
            { key: 'protein', label: 'Protein', unit: 'g' },
            { key: 'carbohydrates', label: 'Carbs', unit: 'g' },
            { key: 'fats', label: 'Fats', unit: 'g' },
            { key: 'fiber', label: 'Fiber', unit: 'g' },
          ] as const).map(({ key, label, unit }) => (
            <div key={key}>
              <label className="label-caps">{label} <span style={{ opacity: 0.6 }}>({unit})</span></label>
              <input
                className="input-field"
                type="number"
                min="0"
                step="0.1"
                value={val(key)}
                onChange={e => setEdited(d => ({ ...d, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        {savedConfirm && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 12px', borderRadius: '10px',
            backgroundColor: 'rgba(124, 168, 126, 0.12)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-protein)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--accent-protein)' }}>
              Saved to favourites
            </span>
          </div>
        )}

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--accent-calories)', paddingLeft: '4px' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button className="btn-ghost" onClick={reset} style={{ flex: 1 }}>
            Clear
          </button>
          <button
            className="btn-secondary"
            onClick={handleSaveFavourite}
            disabled={phase === 'saving' || phase === 'logging' || savedConfirm}
            style={{
              flex: 1,
              color: savedConfirm ? 'var(--accent-protein)' : undefined,
            }}
          >
            {phase === 'saving' ? 'Saving…' : savedConfirm ? '✓ Saved' : '♡ Favourite'}
          </button>
          <button
            className="btn-primary"
            onClick={handleLog}
            disabled={phase === 'logging' || phase === 'saving'}
            style={{ flex: 2, fontSize: '12px', padding: '13px' }}
          >
            {phase === 'logging' ? 'Logging…' : 'Log Meal'}
          </button>
        </div>
      </div>
    )
  }

  if (!user?.has_api_key) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>
          Set up your AI API key in Settings to use text analysis.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <textarea
        className="textarea-field"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="2 eggs and toast with butter, a glass of orange juice..."
        rows={3}
        style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}
      />

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--accent-calories)', paddingLeft: '4px' }}>
          {error}
        </p>
      )}

      <button
        className="btn-primary"
        onClick={handleAnalyse}
        disabled={!text.trim() || phase === 'analysing'}
        style={{ padding: '15px' }}
      >
        {phase === 'analysing' ? 'Analysing…' : 'Estimate Macros'}
      </button>
    </div>
  )
}
