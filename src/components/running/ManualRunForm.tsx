'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/context/UserContext'
import { errorMessage } from '@/components/ui/Toast'
import { DEFAULT_BODYWEIGHT_KG, runKcal } from '@/lib/constants'

export default function ManualRunForm({ onLogged }: { onLogged: () => void }) {
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
    const estimated = runKcal(distKm, weight)
    setCalories(String(estimated))
  }, [distance, user, caloriesManual])

  const distKm = parseFloat(distance)
  const mins = parseInt(minutes) || 0
  const secs = parseInt(seconds) || 0
  const cal = parseFloat(calories)
  const complete = !!distKm && (!!mins || !!secs) && !!cal

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || !complete) return

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
    if (logged) onLogged()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label htmlFor="run-distance" className="label-caps">Distance (km)</label>
        <input
          id="run-distance"
          className="input-field"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="5.00"
          value={distance}
          onChange={e => setDistance(e.target.value)}
          required
        />
      </div>

      <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <legend className="label-caps" style={{ padding: 0 }}>Time</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            aria-label="Minutes"
            className="input-field"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="min"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            style={{ flex: 1 }}
          />
          <span aria-hidden="true" style={{ fontSize: 17, color: 'var(--muted)' }}>:</span>
          <input
            aria-label="Seconds"
            className="input-field"
            type="number"
            inputMode="numeric"
            min="0"
            max="59"
            placeholder="sec"
            value={seconds}
            onChange={e => setSeconds(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="run-kcal" className="label-caps">Calories burned</label>
        <input
          id="run-kcal"
          className="input-field"
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="350"
          value={calories}
          // Emptying the box hands the field back to the distance estimate.
          // Latching `caloriesManual` on the first keystroke and never clearing
          // it meant one stray character permanently disabled the estimate.
          onChange={e => { setCalories(e.target.value); setCaloriesManual(e.target.value !== '') }}
          aria-describedby={!caloriesManual && calories ? 'run-kcal-hint' : undefined}
          required
        />
        {!caloriesManual && calories && (
          <p id="run-kcal-hint" style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Estimated from the distance and your weight. Change it if your watch says otherwise.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 15, color: 'var(--over)' }}>{error}</p>
      )}

      <button type="submit" className="btn-primary" disabled={loading || !complete} style={{ marginTop: 4 }}>
        {loading ? 'Logging…' : 'Log run'}
      </button>
    </form>
  )
}
