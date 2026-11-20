'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser } from '@/context/UserContext'
import { analyseRunScreenshot } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatDuration, formatPace } from '@/lib/format'
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPT_IMAGE_ATTR,
  UNSUPPORTED_IMAGE_MESSAGE,
  downscaleImage,
} from '@/lib/image'
import type { RunAnalysis, RunLog } from '@/types/running'

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '11px 0',
}

/**
 * Reads a run screenshot. `file` is the screenshot picked from the log sheet;
 * it is analysed as soon as it arrives, and "Choose another screenshot" picks
 * a replacement here.
 */
export default function RunPhotoUpload({ file, onLogged }: { file: File | null; onLogged: (run: RunLog) => void }) {
  const { logRun } = useUser()
  const fileRef = useRef<HTMLInputElement>(null)
  const lastFile = useRef<File | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [result, setResult] = useState<RunAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function analyse(picked: File) {
    // HEIC gets a 422 from the vision providers, so it is caught before the
    // round trip rather than after it.
    if (!ACCEPTED_IMAGE_TYPES.includes(picked.type)) {
      setResult(null)
      setError(UNSUPPORTED_IMAGE_MESSAGE)
      return
    }

    setAnalysing(true)
    setResult(null)
    setError(null)
    try {
      // A 4000px screenshot is a 413 on the way up and is downsampled by the
      // provider anyway; send the shrunk copy.
      const analysis = await analyseRunScreenshot(await downscaleImage(picked))
      setResult(analysis)
    } catch (err) {
      setError(errorMessage(err, "Couldn't read that screenshot. Try another, or enter the run manually."))
    } finally {
      setAnalysing(false)
    }
  }

  // The ref guard keeps StrictMode's double effect from analysing (and
  // billing) the same screenshot twice.
  useEffect(() => {
    if (!file || lastFile.current === file) return
    lastFile.current = file
    analyse(file)
  }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    // Reset the input so re-picking the same file after an error still fires
    // `change` (the browser suppresses it when the value is unchanged).
    e.target.value = ''
    if (picked) analyse(picked)
  }

  async function handleConfirm() {
    if (!result || saving) return
    setSaving(true)
    setError(null)
    let logged: RunLog | null = null
    try {
      logged = await logRun({
        distance_meters: result.distance_meters,
        duration_seconds: result.duration_seconds,
        calories_burned: result.calories_burned,
        pace_per_km: result.pace_per_km,
        average_heartrate: result.average_heartrate,
        source: 'ai_parsed',
      })
    } catch (err) {
      // Previously uncaught: the POST failed, the panel stayed open with no
      // explanation, and a second tap risked logging the run twice.
      setError(errorMessage(err, 'Could not log this run'))
    } finally {
      setSaving(false)
    }
    if (logged) onLogged(logged)
  }

  const pickAnother = (
    <button
      type="button"
      className={result ? 'btn-ghost' : 'btn-secondary'}
      onClick={() => fileRef.current?.click()}
      disabled={analysing || saving}
      style={{ width: '100%' }}
    >
      {file || result || error ? 'Choose another screenshot' : 'Choose a screenshot'}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input ref={fileRef} type="file" accept={ACCEPT_IMAGE_ATTR} onChange={handleFile} style={{ display: 'none' }} />

      {analysing && (
        <div role="status">
          <div className="ai-shimmer" style={{ height: 156 }} aria-hidden="true" />
          <p style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--muted)' }}>Reading your screenshot…</p>
        </div>
      )}

      {result && (
        <>
          <div className="card" style={{ padding: '4px 18px' }}>
            {[
              ['Distance', `${(result.distance_meters / 1000).toFixed(2)} km`],
              ['Time', formatDuration(result.duration_seconds)],
              ...(result.pace_per_km ? [['Pace', `${formatPace(result.pace_per_km, 'min')} /km`]] : []),
              ...(result.average_heartrate ? [['Heart rate', `${Math.round(result.average_heartrate)} bpm`]] : []),
              ['Calories burned', `${Math.round(result.calories_burned)} kcal`],
            ].map(([label, value], i) => (
              <div key={label} style={{ ...rowStyle, borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 15, color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}
          </div>

          {result.confidence !== 'high' && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: result.confidence === 'low' ? 'var(--over)' : 'var(--muted)' }}>
              {result.confidence === 'low' ? 'Hard to read this one' : 'Not fully sure about this one'}
              {result.notes ? `: ${result.notes.trim().replace(/\.$/, '')}` : ''}. Check the numbers before you log it.
            </p>
          )}
        </>
      )}

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: 'var(--over)' }}>{error}</p>
      )}

      {result && (
        <button type="button" className="btn-primary" onClick={handleConfirm} disabled={saving}>
          {saving ? 'Logging…' : 'Log run'}
        </button>
      )}

      {!analysing && pickAnother}
    </div>
  )
}
