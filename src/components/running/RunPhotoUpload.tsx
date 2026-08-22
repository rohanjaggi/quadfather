'use client'

import { useState, useRef } from 'react'
import { useUser } from '@/context/UserContext'
import { analyseRunScreenshot } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPT_IMAGE_ATTR,
  UNSUPPORTED_IMAGE_MESSAGE,
  downscaleImage,
} from '@/lib/image'
import type { RunAnalysis } from '@/types/running'

interface RunPhotoUploadProps {
  onClose: () => void
}

export default function RunPhotoUpload({ onClose }: RunPhotoUploadProps) {
  const { logRun } = useUser()
  const fileRef = useRef<HTMLInputElement>(null)
  const [analysing, setAnalysing] = useState(false)
  const [result, setResult] = useState<RunAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so re-picking the same file after an error still fires
    // `change` (the browser suppresses it when the value is unchanged).
    e.target.value = ''
    if (!file) return

    // HEIC gets a 422 from the vision providers, so it is caught before the
    // round trip rather than after it.
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError(UNSUPPORTED_IMAGE_MESSAGE)
      return
    }

    setAnalysing(true)
    setError(null)
    try {
      // A 4000px screenshot is a 413 on the way up and is downsampled by the
      // provider anyway; send the shrunk copy.
      const analysis = await analyseRunScreenshot(await downscaleImage(file))
      setResult(analysis)
    } catch (err) {
      setError(errorMessage(err, 'Failed to analyse screenshot'))
    } finally {
      setAnalysing(false)
    }
  }

  async function handleConfirm() {
    if (!result || saving) return
    setSaving(true)
    setError(null)
    let logged = false
    try {
      await logRun({
        distance_meters: result.distance_meters,
        duration_seconds: result.duration_seconds,
        calories_burned: result.calories_burned,
        pace_per_km: result.pace_per_km,
        average_heartrate: result.average_heartrate,
        source: 'ai_parsed',
      })
      logged = true
    } catch (err) {
      // Previously uncaught: the POST failed, the panel stayed open with no
      // explanation, and a second tap risked logging the run twice.
      setError(errorMessage(err, 'Could not log this run'))
    } finally {
      setSaving(false)
    }
    if (logged) onClose()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_IMAGE_ATTR}
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {!result && !analysing && (
        <button
          className="btn-primary"
          onClick={() => fileRef.current?.click()}
          style={{ width: '100%' }}
        >
          Upload Screenshot
        </button>
      )}

      {analysing && (
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          color: 'var(--tg-theme-hint-color)',
          textAlign: 'center',
          padding: '20px 0',
        }}>
          Analysing screenshot…
        </p>
      )}

      {error && (
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          color: '#D32F2F',
          textAlign: 'center',
        }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}>
            <div>
              <p className="label-caps" style={{ marginBottom: '2px' }}>Distance</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
                {(result.distance_meters / 1000).toFixed(2)} km
              </p>
            </div>
            <div>
              <p className="label-caps" style={{ marginBottom: '2px' }}>Duration</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
                {Math.floor(result.duration_seconds / 60)}:{(result.duration_seconds % 60).toString().padStart(2, '0')}
              </p>
            </div>
            <div>
              <p className="label-caps" style={{ marginBottom: '2px' }}>Calories</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, color: 'var(--accent-calories)' }}>
                {Math.round(result.calories_burned)} kcal
              </p>
            </div>
            {result.pace_per_km && (
              <div>
                <p className="label-caps" style={{ marginBottom: '2px' }}>Pace</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
                  {Math.floor(result.pace_per_km)}:{Math.round((result.pace_per_km % 1) * 60).toString().padStart(2, '0')} /km
                </p>
              </div>
            )}
          </div>

          {result.confidence !== 'high' && (
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              color: result.confidence === 'low' ? '#D32F2F' : 'var(--tg-theme-hint-color)',
              fontStyle: 'italic',
            }}>
              Confidence: {result.confidence} — {result.notes}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleConfirm} disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving…' : 'Confirm & Log'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
