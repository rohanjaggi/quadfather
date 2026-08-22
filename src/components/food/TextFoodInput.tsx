'use client'

import { useState } from 'react'
import { parseFood } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/TelegramProvider'
import { errorMessage } from '@/components/ui/Toast'
import { errorStatus } from '@/lib/errors'
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
    if (!text.trim() || phase === 'analysing') return
    setPhase('analysing')
    setError(null)
    try {
      const data = await parseFood(text.trim())
      setResult(data)
      setEdited({})
      setPhase('result')
    } catch (err) {
      setError(errorMessage(err, 'Analysis failed'))
      setPhase('idle')
    }
  }

  async function handleLog() {
    if (!result || phase === 'logging' || phase === 'saving') return
    setPhase('logging')
    setError(null)
    const merged = { ...result, ...edited }
    let logged = false
    try {
      await logFood({
        food_name: merged.food_name ?? result.food_name,
        calories: Number(merged.calories ?? result.calories),
        protein: Number(merged.protein ?? result.protein),
        carbohydrates: Number(merged.carbohydrates ?? result.carbohydrates),
        fats: Number(merged.fats ?? result.fats),
        fiber: Number(merged.fiber ?? result.fiber),
        source: 'ai-text',
      })
      logged = true
    } catch (err) {
      setError(errorMessage(err, 'Could not log this meal'))
      haptic.notification('error')
    } finally {
      setPhase('result')
    }
    if (logged) {
      haptic.notification('success')
      onClose()
    }
  }

  async function handleSaveFavourite() {
    if (!result || phase === 'saving' || phase === 'logging') return
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
    } catch (err) {
      // Match on the parsed HTTP status, not a substring: `raw.includes('409')`
      // also fired on a perfectly ordinary body like `{"calories":409}`.
      setError(errorStatus(err) === 409
        ? 'A favourite with this name already exists'
        : errorMessage(err, 'Could not save'))
    } finally {
      setPhase('result')
    }
  }

  /**
   * Every edit to the parsed macros goes through here so the "✓ Saved"
   * confirmation is retired: once the numbers on screen differ from the
   * favourite that was written, the button has to become tappable again —
   * otherwise it sat disabled on "✓ Saved" and the edit could never be saved.
   */
  function applyEdit(update: (prev: Partial<MealAnalysis>) => Partial<MealAnalysis>) {
    setEdited(update)
    setSavedConfirm(false)
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
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              color: 'var(--tg-theme-hint-color)',
            }}>
              AI estimate
            </span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500,
              color: confidenceColor,
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: confidenceColor }} />
              {result.confidence} confidence
            </span>
          </div>
          {result.notes && (
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: '12px', lineHeight: '1.4',
              color: 'var(--tg-theme-hint-color)', margin: 0,
            }}>
              {result.notes}
            </p>
          )}
        </div>

        <div>
          <label className="label-caps">Food name</label>
          <input
            className="input-field"
            value={val('food_name')}
            onChange={e => applyEdit(d => ({ ...d, food_name: e.target.value }))}
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
                onChange={e => applyEdit(d => ({ ...d, [key]: e.target.value }))}
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
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--accent-protein)' }}>
              Saved to favourites
            </span>
          </div>
        )}

        {error && (
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--accent-calories)', paddingLeft: '4px' }}>
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
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>
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
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--accent-calories)', paddingLeft: '4px' }}>
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
