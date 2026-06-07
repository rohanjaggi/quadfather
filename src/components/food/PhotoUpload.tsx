'use client'

import { useRef, useState } from 'react'
import { analyseMeal } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/TelegramProvider'
import type { MealAnalysis } from '@/types/api'

type Phase = 'idle' | 'analysing' | 'result' | 'logging' | 'saving'

export default function PhotoUpload({ onClose }: { onClose: () => void }) {
  const { user, logFood, saveFood } = useUser()
  const haptic = useHaptic()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MealAnalysis | null>(null)
  const [edited, setEdited] = useState<Partial<MealAnalysis>>({})
  const [savedConfirm, setSavedConfirm] = useState(false)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setPhase('idle')
    setResult(null)
    setError(null)
    setSavedConfirm(false)
  }

  async function handleAnalyse() {
    if (!file) return
    setPhase('analysing')
    setError(null)
    try {
      const data = await analyseMeal(file, description)
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
      source: 'ai-photo',
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
        source: 'ai-photo',
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
    setFile(null)
    setPreview(null)
    setDescription('')
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
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Meal" style={{
            width: '100%', maxHeight: '140px', objectFit: 'cover',
            borderRadius: '14px', display: 'block',
          }} />
        )}

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
            Retake
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
          Set up your AI API key in Settings to use photo analysis.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          borderRadius: '18px',
          border: '1.5px dashed var(--surface-border)',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: preview ? 0 : '36px 24px',
          overflow: 'hidden',
          minHeight: preview ? '160px' : undefined,
          cursor: 'pointer',
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Meal preview" style={{
            width: '100%', objectFit: 'cover', maxHeight: '200px', display: 'block',
          }} />
        ) : (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              backgroundColor: 'var(--tg-theme-bg-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="var(--tg-theme-hint-color)" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, color: 'var(--tg-theme-text-color)', marginBottom: '4px' }}>
              Photograph your meal
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
              or upload from your gallery
            </p>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      <textarea
        className="textarea-field"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Describe the meal, portions, ingredients… (optional)"
        rows={2}
      />

      {error && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--accent-calories)', paddingLeft: '4px' }}>
          {error}
        </p>
      )}

      <button
        className="btn-primary"
        onClick={handleAnalyse}
        disabled={!file || phase === 'analysing'}
        style={{ padding: '15px' }}
      >
        {phase === 'analysing' ? 'Analysing…' : 'Analyse Macros'}
      </button>
    </div>
  )
}
