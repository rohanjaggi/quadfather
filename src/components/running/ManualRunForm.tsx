'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/context/UserContext'
import { errorMessage } from '@/components/ui/Toast'
import { DEFAULT_BODYWEIGHT_KG } from '@/lib/constants'

interface ManualRunFormProps {
  onClose: () => void
}

export default function ManualRunForm({ onClose }: ManualRunFormProps) {
  const { user, logRun } = useUser()
  const [distance, setDistance] = useState('')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [calories, setCalories] = useState('')
  const [caloriesManual, setCaloriesManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (caloriesManual) return
    const distKm = parseFloat(distance)
    if (!distKm || distKm <= 0) return
    const weight = user?.personal?.weight_kg ?? DEFAULT_BODYWEIGHT_KG
    const estimated = Math.round(distKm * weight * 1.036)
    setCalories(String(estimated))
  }, [distance, user, caloriesManual])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const distKm = parseFloat(distance)
    const mins = parseInt(minutes) || 0
    const secs = parseInt(seconds) || 0
    const cal = parseFloat(calories)

    if (loading || !distKm || (!mins && !secs) || !cal) return

    setLoading(true)
    setError(null)
    let logged = false
    try {
      await logRun({
        distance_meters: distKm * 1000,
        duration_seconds: mins * 60 + secs,
        calories_burned: cal,
        source: 'manual',
      })
      logged = true
    } catch (err) {
      setError(errorMessage(err, 'Could not log this run'))
    } finally {
      setLoading(false)
    }
    if (logged) onClose()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>
          Distance (km)
        </label>
        <input
          className="input-field"
          type="number"
          step="0.01"
          placeholder="5.00"
          value={distance}
          onChange={e => setDistance(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>
          Duration
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input-field"
            type="number"
            placeholder="mm"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            style={{ flex: 1 }}
          />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            color: 'var(--tg-theme-hint-color)',
            alignSelf: 'center',
          }}>:</span>
          <input
            className="input-field"
            type="number"
            placeholder="ss"
            max="59"
            value={seconds}
            onChange={e => setSeconds(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <div>
        <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>
          Calories burned {!caloriesManual && calories && (
            <span style={{ fontWeight: 400, letterSpacing: 'normal', textTransform: 'none', opacity: 0.7 }}>
              (estimated)
            </span>
          )}
        </label>
        <input
          className="input-field"
          type="number"
          placeholder="350"
          value={calories}
          // Emptying the box hands the field back to the distance estimate.
          // Latching `caloriesManual` on the first keystroke and never clearing
          // it meant one stray character permanently disabled the estimate.
          onChange={e => { setCalories(e.target.value); setCaloriesManual(e.target.value !== '') }}
          required
        />
      </div>

      {error && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '12px',
          color: 'var(--accent-calories)', paddingLeft: '4px',
        }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
          {loading ? 'Saving…' : 'Log Run'}
        </button>
      </div>
    </form>
  )
}
