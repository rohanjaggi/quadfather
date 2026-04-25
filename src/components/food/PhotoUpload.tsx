'use client'

import { useRef, useState } from 'react'
import { analyseMeal } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import type { MealAnalysis } from '@/types/api'

type Phase = 'idle' | 'analysing' | 'result' | 'logging' | 'saving'

export default function PhotoUpload({ onClose }: { onClose: () => void }) {
  const { user, logFood, saveFood } = useUser()
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
      source: 'gemini',
    })
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
        description: result.notes || undefined,
        source: 'gemini',
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

  const inputStyle = {
    width: '100%',
    borderRadius: '12px',
    padding: '11px 13px',
    fontSize: '15px',
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    border: 'none',
    outline: 'none',
    backgroundColor: 'var(--tg-theme-bg-color)',
    color: 'var(--tg-theme-text-color)',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--tg-theme-hint-color)',
    display: 'block',
    marginBottom: '5px',
  }

  // ── Result view ──────────────────────────────────────────────────────────
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

        {/* Preview thumbnail */}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Meal" style={{
            width: '100%', maxHeight: '140px', objectFit: 'cover',
            borderRadius: '14px', display: 'block',
          }} />
        )}

        {/* Confidence badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: confidenceColor }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
            {result.confidence} confidence — {result.notes}
          </span>
        </div>

        {/* Editable fields */}
        <div>
          <label style={labelStyle}>Food name</label>
          <input
            style={inputStyle}
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
          ] as const).map(({ key, label, unit }) => (
            <div key={key}>
              <label style={labelStyle}>{label} <span style={{ opacity: 0.6 }}>({unit})</span></label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.1"
                value={val(key)}
                onChange={e => setEdited(d => ({ ...d, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        {/* Saved confirmation */}
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

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={reset}
            style={{
              flex: 1, padding: '13px', borderRadius: '13px', border: 'none',
              backgroundColor: 'var(--tg-theme-bg-color)',
              color: 'var(--tg-theme-hint-color)',
              fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500,
            }}
          >
            Retake
          </button>
          <button
            onClick={handleSaveFavourite}
            disabled={phase === 'saving' || phase === 'logging' || savedConfirm}
            style={{
              flex: 1, padding: '13px', borderRadius: '13px',
              border: '1px solid var(--surface-border)',
              backgroundColor: 'transparent',
              color: savedConfirm ? 'var(--accent-protein)' : 'var(--tg-theme-text-color)',
              fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500,
              opacity: (phase === 'saving' || phase === 'logging') ? 0.5 : 1,
            }}
          >
            {phase === 'saving' ? 'Saving…' : savedConfirm ? '✓ Saved' : '♡ Favourite'}
          </button>
          <button
            onClick={handleLog}
            disabled={phase === 'logging' || phase === 'saving'}
            style={{
              flex: 2, padding: '13px', borderRadius: '13px', border: 'none',
              backgroundColor: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: (phase === 'logging' || phase === 'saving') ? 0.5 : 1,
            }}
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
          Set up your AI API key in Settings to use photo analysis.
        </p>
      </div>
    )
  }

  // ── Idle / Analysing view ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Upload zone */}
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
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--tg-theme-hint-color)' }}>
              or upload from your gallery
            </p>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Describe the meal, portions, ingredients… (optional)"
        rows={2}
        style={{
          width: '100%', borderRadius: '14px', padding: '13px 16px',
          fontSize: '14px', fontFamily: 'var(--font-body)',
          resize: 'none', outline: 'none', border: 'none',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          color: 'var(--tg-theme-text-color)',
        }}
      />

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--accent-calories)', paddingLeft: '4px' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleAnalyse}
        disabled={!file || phase === 'analysing'}
        style={{
          width: '100%', borderRadius: '14px', padding: '15px',
          fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500,
          letterSpacing: '0.09em', textTransform: 'uppercase',
          border: 'none',
          backgroundColor: 'var(--tg-theme-button-color)',
          color: 'var(--tg-theme-button-text-color)',
          opacity: (!file || phase === 'analysing') ? 0.3 : 1,
          cursor: (!file || phase === 'analysing') ? 'not-allowed' : 'pointer',
        }}
      >
        {phase === 'analysing' ? 'Analysing…' : 'Analyse Macros'}
      </button>

    </div>
  )
}
