'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { analyseMeal, parseFood } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import { useHaptic } from '@/components/telegram'
import { errorMessage, errorStatus } from '@/lib/errors'
import { formatInt } from '@/lib/format'
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPT_IMAGE_ATTR,
  UNSUPPORTED_IMAGE_MESSAGE,
  downscaleImage,
} from '@/lib/image'
import Sheet from '@/components/ui/Sheet'
import ManualFoodForm, { type FoodValues } from '@/components/food/ManualFoodForm'
import { macroLine } from '@/components/food/meals'
import { toastMealLogged } from '@/components/food/logged'
import { BookmarkIcon, CameraIcon, CheckIcon, CloseIcon, EditIcon, SendIcon } from '@/components/ui/icons'
import type { FoodLog, MealAnalysis } from '@/types/api'

/** Element ids the Food page's deep links (`?mode=photo|describe`) reach for. */
export const COMPOSER_INPUT_ID = 'meal-composer-input'
export const PHOTO_INPUT_ID = 'meal-photo-input'

type Phase = 'idle' | 'analysing' | 'result' | 'logging' | 'saving'
type Draft = MealAnalysis & { source: 'ai-photo' | 'ai-text' }

const raised: React.CSSProperties = { boxShadow: 'var(--shadow-raised)' }
const caption: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--muted)' }
const thumb: React.CSSProperties = { width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0, display: 'block' }
const roundBtn: React.CSSProperties = {
  width: 44, height: 44, flexShrink: 0, borderRadius: 22, border: 'none', padding: 0,
  display: 'grid', placeItems: 'center', background: 'transparent', color: 'var(--muted)',
}
const CONFIDENCE = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence, check the numbers' }

/**
 * Chat-style meal logging: describe it, or attach a photo (with optional
 * details), and send. The estimate comes back as a confirm card in the same
 * spot, so "Log meal" lands where the thumb already is.
 */
export default function MealComposer({ onManual }: { onManual: () => void }) {
  const { user, logFood, deleteFood, saveFood } = useUser()
  const haptic = useHaptic()
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [savedConfirm, setSavedConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [focused, setFocused] = useState(false)
  // Bumped by Cancel: a late answer from a cancelled request is ignored.
  const request = useRef(0)
  const closeEdit = useCallback(() => setEditing(false), [])

  // Every object URL created here is revoked when it is replaced and when the
  // component unmounts — otherwise each retake leaks the whole decoded image
  // for the lifetime of the document.
  const previewUrl = useRef<string | null>(null)

  function setPreviewFrom(f: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = f ? URL.createObjectURL(f) : null
    setPreview(previewUrl.current)
  }

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = null
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    // Reset the input so re-picking the same file after an error still fires
    // `change` (the browser suppresses it when the value is unchanged).
    e.target.value = ''
    if (!f) return
    setDraft(null)
    setSavedConfirm(false)
    setPhase('idle')
    if (!ACCEPTED_IMAGE_TYPES.includes(f.type)) {
      setFile(null)
      setPreviewFrom(null)
      setError(UNSUPPORTED_IMAGE_MESSAGE)
      return
    }
    setFile(f)
    setPreviewFrom(f)
    setError(null)
  }

  function removePhoto() {
    setFile(null)
    setPreviewFrom(null)
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (phase === 'analysing' || (!file && !text.trim())) return
    const id = ++request.current
    inputRef.current?.blur() // drops the keyboard so the working card is visible
    setPhase('analysing')
    setError(null)
    try {
      const data = file
        ? await analyseMeal(await downscaleImage(file), text)
        : await parseFood(text.trim())
      if (id !== request.current) return
      setDraft({ ...data, source: file ? 'ai-photo' : 'ai-text' })
      setSavedConfirm(false)
      setPhase('result')
    } catch (err) {
      if (id !== request.current) return
      setError(errorMessage(err, "Couldn't work out the macros. Try again."))
      setPhase('idle')
    }
  }

  function cancel() {
    request.current++
    setPhase('idle')
  }

  /** Back to the composer with the words and photo kept, to rephrase. */
  function discard() {
    setDraft(null)
    setSavedConfirm(false)
    setError(null)
    setPhase('idle')
  }

  function reset() {
    setText('')
    removePhoto()
    discard()
  }

  async function handleLog() {
    if (!draft || phase === 'logging' || phase === 'saving') return
    setPhase('logging')
    setError(null)
    let log: FoodLog
    try {
      log = await logFood({
        food_name: draft.food_name,
        calories: Number(draft.calories),
        protein: Number(draft.protein),
        carbohydrates: Number(draft.carbohydrates),
        fats: Number(draft.fats),
        fiber: Number(draft.fiber),
        source: draft.source,
      })
    } catch (err) {
      setError(errorMessage(err, 'Could not log this meal'))
      haptic.notification('error')
      setPhase('result')
      return
    }
    haptic.notification('success')
    toastMealLogged(log, deleteFood)
    reset()
  }

  async function handleSaveFavourite() {
    if (!draft || phase === 'saving' || phase === 'logging') return
    setPhase('saving')
    setError(null)
    try {
      await saveFood({
        name: draft.food_name,
        calories: Number(draft.calories),
        protein: Number(draft.protein),
        carbohydrates: Number(draft.carbohydrates),
        fats: Number(draft.fats),
        fiber: Number(draft.fiber),
        description: draft.notes || undefined,
        source: draft.source,
      })
      setSavedConfirm(true)
    } catch (err) {
      // Match on the parsed HTTP status, not a substring: `raw.includes('409')`
      // also fired on a perfectly ordinary body like `{"calories":409}`.
      setError(errorStatus(err) === 409
        ? 'You already have a saved food with this name'
        : errorMessage(err, 'Could not save this meal'))
    } finally {
      setPhase('result')
    }
  }

  // An edit retires the "Saved" state: once the numbers differ from the saved
  // food, saving has to be possible again.
  const applyEdit = useCallback((values: FoodValues) => {
    setDraft(d => d && { ...d, ...values })
    setSavedConfirm(false)
    setEditing(false)
  }, [])

  if (!user?.has_api_key) {
    return (
      <div className="card" style={{ ...raised, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ ...caption, fontSize: 14 }}>
          Describing or snapping a meal needs an AI key.{' '}
          <Link href="/profile/api-key" style={{ color: 'var(--action)', fontWeight: 600, textDecoration: 'none' }}>Add a key</Link>
        </p>
        <button type="button" className="btn-primary" onClick={onManual}>Enter a meal manually</button>
      </div>
    )
  }

  const busy = phase === 'logging' || phase === 'saving'

  return (
    <>
      <input
        ref={fileRef}
        id={PHOTO_INPUT_ID}
        type="file"
        accept={ACCEPT_IMAGE_ATTR}
        onChange={handleFile}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {phase === 'analysing' ? (
        <div className="card" style={{ ...raised, display: 'flex', alignItems: 'center', gap: 14 }} role="status">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" style={thumb} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ai-shimmer" style={{ height: 30 }} aria-hidden="true" />
            <p style={{ ...caption, marginTop: 8, fontSize: 15, color: 'var(--ink)' }}>
              {file ? 'Reading your photo…' : 'Working out the macros…'}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={cancel}>Cancel</button>
        </div>
      ) : draft ? (
        <section
          className="card"
          aria-label="Meal estimate"
          style={{ ...raised, padding: '16px 18px 10px', maxHeight: 'calc(100svh - 200px)', overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview && <img src={preview} alt="Your meal" style={thumb} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{draft.food_name}</h2>
              <p style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{formatInt(Number(draft.calories))}</span>
                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--muted)' }}>kcal</span>
              </p>
            </div>
            <button type="button" onClick={discard} aria-label="Discard this estimate" style={{ ...roundBtn, marginTop: -8, marginRight: -10 }}>
              <CloseIcon size={20} />
            </button>
          </div>

          <p style={{ ...caption, marginTop: 8, fontSize: 14, color: 'var(--ink)' }}>
            {macroLine({
              protein: Number(draft.protein),
              carbohydrates: Number(draft.carbohydrates),
              fats: Number(draft.fats),
              fiber: Number(draft.fiber),
            }, true)}
          </p>
          <p style={{ ...caption, marginTop: 6 }}>
            {CONFIDENCE[draft.confidence] ?? 'Estimate'}{draft.notes ? `. ${draft.notes}` : ''}
          </p>

          {error && <p role="alert" style={{ ...caption, marginTop: 10, color: 'var(--over)' }}>{error}</p>}

          <button type="button" className="btn-primary" onClick={handleLog} disabled={busy} style={{ marginTop: 14 }}>
            {phase === 'logging' ? 'Logging…' : 'Log meal'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditing(true)}
              disabled={busy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: -12 }}
            >
              <EditIcon size={18} /> Edit
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleSaveFavourite}
              disabled={busy || savedConfirm}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: -12, color: savedConfirm ? 'var(--good)' : undefined }}
            >
              {savedConfirm ? <><CheckIcon size={18} /> Saved</> : <><BookmarkIcon size={18} /> {phase === 'saving' ? 'Saving…' : 'Save to favourites'}</>}
            </button>
          </div>
        </section>
      ) : (
        <>
          {(error || preview) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 6px 8px' }}>
              <p role={error ? 'alert' : undefined} style={{ ...caption, flex: 1, color: error ? 'var(--over)' : 'var(--muted)' }}>
                {error ?? 'Photo added. Add details or send.'}
              </p>
              {preview && !error && (
                <button type="button" className="btn-ghost" onClick={removePhoto} style={{ marginRight: -8 }}>Remove</button>
              )}
            </div>
          )}
          <form
            onSubmit={handleSend}
            style={{
              ...raised,
              display: 'flex', alignItems: 'center', gap: 2, padding: 4, minHeight: 54,
              background: 'var(--card)', borderRadius: 27,
              border: `1px solid ${focused ? 'var(--action)' : 'var(--line-strong)'}`,
              transition: 'border-color .2s ease',
            }}
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={file ? 'Change photo' : 'Add a photo'}
              style={roundBtn}
            >
              {preview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={preview} alt="" style={{ ...thumb, width: 34, height: 34, borderRadius: 10 }} />
                : <CameraIcon size={23} />}
            </button>
            <input
              ref={inputRef}
              id={COMPOSER_INPUT_ID}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={file ? 'Add details (optional)…' : 'Describe what you ate…'}
              aria-label={file ? 'Details about the photo (optional)' : 'Describe what you ate'}
              enterKeyHint="send"
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0, height: 44, padding: '0 6px',
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 16, color: 'var(--ink)', fontFamily: 'var(--font-body)',
              }}
            />
            <button
              type="submit"
              aria-label="Work out the macros"
              disabled={!file && !text.trim()}
              style={{
                ...roundBtn,
                background: !file && !text.trim() ? 'var(--track)' : 'var(--action)',
                color: !file && !text.trim() ? 'var(--muted)' : 'var(--action-ink)',
              }}
            >
              <SendIcon size={22} strokeWidth={2.2} />
            </button>
          </form>
        </>
      )}

      <Sheet open={editing} onClose={closeEdit} title="Edit meal">
        {draft && <ManualFoodForm initial={draft} onApply={applyEdit} submitLabel="Update estimate" />}
      </Sheet>
    </>
  )
}
