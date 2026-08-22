'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { analyseWorkout } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import type { WorkoutAnalysis as AnalysisType } from '@/types/exercises'
import type { ExerciseLogEntry } from '@/types/workouts'
import type { MuscleZone } from '@/lib/muscle-zones'
import MuscleMap from './MuscleMap'
import { calculateMuscleIntensities, intensitiesFromMuscleNames } from '@/lib/muscle-intensity'
import { useUser } from '@/context/UserContext'

interface WorkoutAnalysisProps {
  workoutId: number
  existingAnalysis?: AnalysisType | null
  exercises?: ExerciseLogEntry[]
  /**
   * Whether this workout may analyse itself on mount. `/analyse` is a paid LLM
   * call (and sends a Telegram message), so the list only sets this on the
   * single most recent workout that has no analysis yet — everything else waits
   * for an explicit tap.
   */
  autoAnalyse?: boolean
}

export default function WorkoutAnalysis({ workoutId, existingAnalysis, exercises, autoAnalyse = false }: WorkoutAnalysisProps) {
  const { user } = useUser()
  const [analysis, setAnalysis] = useState<AnalysisType | null>(existingAnalysis ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [intensities, setIntensities] = useState<Record<MuscleZone, number>>({} as Record<MuscleZone, number>)

  const hasKey = user?.has_api_key === true

  // Guards against the auto-run looping on every render / StrictMode remount.
  // An explicit retry resets it, so a failure is recoverable without a reload.
  const attemptedRef = useRef<number | null>(null)

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyseWorkout(workoutId)
      setAnalysis(result)
    } catch (err) {
      setError(errorMessage(err, 'Analysis failed'))
    } finally {
      setLoading(false)
    }
  }, [workoutId])

  useEffect(() => {
    if (existingAnalysis) {
      setAnalysis(existingAnalysis)
      return
    }
    // No key means every request 4xxs — don't spend a round trip to find out.
    if (!autoAnalyse || !hasKey) return
    if (attemptedRef.current === workoutId) return
    attemptedRef.current = workoutId
    runAnalysis()
  }, [workoutId, existingAnalysis, autoAnalyse, hasKey, runAnalysis])

  function handleManualAnalyse() {
    attemptedRef.current = workoutId
    runAnalysis()
  }

  useEffect(() => {
    let cancelled = false
    if (exercises && exercises.length > 0) {
      calculateMuscleIntensities(exercises)
        .then(result => {
          if (cancelled) return
          if (Object.keys(result).length > 0) {
            setIntensities(result)
          } else if (analysis?.muscle_groups_hit) {
            setIntensities(intensitiesFromMuscleNames(analysis.muscle_groups_hit))
          }
        })
        .catch(err => console.error('Failed to compute muscle intensities:', err))
      return () => { cancelled = true }
    }
    if (analysis?.muscle_groups_hit) {
      setIntensities(intensitiesFromMuscleNames(analysis.muscle_groups_hit))
    }
    return () => { cancelled = true }
  }, [exercises, analysis])

  const hasContent = Object.keys(intensities).length > 0 || analysis

  const hintStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)', fontSize: '11px',
    color: 'var(--tg-theme-hint-color)', marginTop: '8px',
  }

  const inlineButtonStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    fontFamily: 'var(--font-display)', fontSize: '11px',
    color: 'var(--tg-theme-button-color)',
  }

  if (loading && !hasContent) {
    return <p style={hintStyle}>Analyzing...</p>
  }

  if (!hasContent) {
    if (error) {
      return (
        <p style={{ ...hintStyle, color: 'var(--accent-calories)' }}>
          {error}{' '}
          <button type="button" onClick={handleManualAnalyse} style={inlineButtonStyle}>
            Retry
          </button>
        </p>
      )
    }
    // Nothing to show yet — offer the call rather than making it unprompted.
    if (hasKey) {
      return (
        <p style={hintStyle}>
          <button type="button" onClick={handleManualAnalyse} style={inlineButtonStyle}>
            Analyse
          </button>
        </p>
      )
    }
    return null
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-button-color)',
        }}
      >
        {expanded ? '▾ Hide analysis' : '▸ View analysis'}
      </button>
      {expanded && (
        <div style={{
          marginTop: '8px', padding: '12px', borderRadius: '12px',
          backgroundColor: 'var(--tg-theme-bg-color)',
        }}>
          {Object.keys(intensities).length > 0 && (
            <MuscleMap intensities={intensities} size="sm" sex={user?.personal?.sex} />
          )}
          {analysis?.prs && analysis.prs.length > 0 && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--accent)', marginBottom: '6px' }}>
              PR: {analysis.prs.map(p => `${p.exercise} — ${p.value}`).join(', ')}
            </p>
          )}
          {analysis?.volume_comparison && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '6px' }}>
              {analysis.volume_comparison}
            </p>
          )}
          {analysis?.takeaway && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-text-color)' }}>
              {analysis.takeaway}
            </p>
          )}
          {!analysis && !loading && hasKey && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
              <button type="button" onClick={handleManualAnalyse} style={inlineButtonStyle}>
                Analyse this session
              </button>
            </p>
          )}
          {!analysis && loading && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
              Analyzing...
            </p>
          )}
          {!analysis && error && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--accent-calories)' }}>
              {error}{' '}
              <button type="button" onClick={handleManualAnalyse} style={inlineButtonStyle}>
                Retry
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
