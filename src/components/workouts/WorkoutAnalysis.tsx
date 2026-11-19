'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { analyseWorkout } from '@/lib/api'
import type { WorkoutAnalysis as AnalysisType } from '@/types/exercises'
import type { ExerciseLogEntry } from '@/types/workouts'
import type { MuscleZone } from '@/lib/muscle-zones'
import MuscleMap from './MuscleMap'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { AiWorking, ErrorRetry, friendlyError } from './bits'
import { calculateMuscleIntensities, intensitiesFromMuscleNames } from '@/lib/muscle-intensity'
import { useUser } from '@/context/UserContext'

/**
 * `/analyse` is a paid LLM call that also sends a Telegram message, and the
 * same session can be on screen twice in a row (the finish screen, then the
 * Training tab's "Last session"). These live for the page session so the
 * second mount joins or reuses the first call instead of paying again.
 */
const results = new Map<number, AnalysisType>()
const inFlight = new Map<number, Promise<AnalysisType>>()
const autoAttempted = new Set<number>()

interface WorkoutAnalysisProps {
  workoutId: number
  existingAnalysis?: AnalysisType | null
  exercises?: ExerciseLogEntry[]
  /**
   * Whether this workout may analyse itself on mount. Only the single most
   * recent un-analysed workout sets this; everything else waits for a tap.
   */
  autoAnalyse?: boolean
  /** Draw the muscle map for this session. */
  showMap?: boolean
  /** Show the AI part at all (the user's `workout_analysis` preference). */
  allowAnalysis?: boolean
  /** The finish screen lists new records itself, from the save response. */
  hidePrs?: boolean
  /** Fires once the analysis has finished (either way) or won't run. */
  onSettled?: () => void
  /** Wrap in a card with this title (and render nothing, not an empty card, when there's nothing). */
  title?: string
}

export default function WorkoutAnalysis({
  workoutId, existingAnalysis, exercises, autoAnalyse = false,
  showMap = false, allowAnalysis = true, hidePrs = false, onSettled, title,
}: WorkoutAnalysisProps) {
  const { user } = useUser()
  const [analysis, setAnalysis] = useState<AnalysisType | null>(existingAnalysis ?? results.get(workoutId) ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intensities, setIntensities] = useState<Record<MuscleZone, number>>({} as Record<MuscleZone, number>)

  const hasKey = user?.has_api_key === true
  const settled = useRef(onSettled)
  settled.current = onSettled

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    let request = inFlight.get(workoutId)
    if (!request) {
      request = analyseWorkout(workoutId)
        .then(r => { results.set(workoutId, r); return r })
        .finally(() => { inFlight.delete(workoutId) })
      inFlight.set(workoutId, request)
    }
    try {
      setAnalysis(await request)
    } catch (err) {
      setError(friendlyError(err, 'Couldn’t look over this session just now.'))
    } finally {
      setLoading(false)
      settled.current?.()
    }
  }, [workoutId])

  useEffect(() => {
    const known = existingAnalysis ?? results.get(workoutId)
    if (known) {
      setAnalysis(known)
      settled.current?.()
      return
    }
    if (!allowAnalysis) { settled.current?.(); return }
    // Another mount already asked: wait on that answer rather than paying again.
    if (inFlight.has(workoutId)) { runAnalysis(); return }
    // No key means every request 4xxs — don't spend a round trip to find out.
    if (!autoAnalyse || !hasKey || autoAttempted.has(workoutId)) { settled.current?.(); return }
    autoAttempted.add(workoutId)
    runAnalysis()
  }, [workoutId, existingAnalysis, autoAnalyse, hasKey, allowAnalysis, runAnalysis])

  useEffect(() => {
    if (!showMap) return
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
  }, [exercises, analysis, showMap])

  const map = showMap && Object.keys(intensities).length > 0
    ? <MuscleMap intensities={intensities} size="sm" sex={user?.personal?.sex} />
    : null

  let body: React.ReactNode = null
  if (allowAnalysis) {
    if (loading) {
      body = <AiWorking label="Looking over this session…" />
    } else if (analysis) {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {analysis.takeaway && (
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--ink)' }}>{analysis.takeaway}</p>
          )}
          {analysis.volume_comparison && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>{analysis.volume_comparison}</p>
          )}
          {!hidePrs && (analysis.prs?.length ?? 0) > 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              New record{analysis.prs.length > 1 ? 's' : ''}:{' '}
              {analysis.prs.map((p, i) => (
                <span key={i}>{i > 0 && ', '}{p.exercise} <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{p.value}</span></span>
              ))}
            </p>
          )}
        </div>
      )
    } else if (error) {
      body = <ErrorRetry message={error} onRetry={() => { autoAttempted.add(workoutId); runAnalysis() }} />
    } else if (hasKey) {
      // Nothing yet: offer the call rather than making it unprompted.
      body = (
        <button type="button" className="btn-secondary" onClick={() => { autoAttempted.add(workoutId); runAnalysis() }}>
          Get feedback on this session
        </button>
      )
    }
  }

  if (!map && !body) return null
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {map}
      {body}
    </div>
  )
  return title ? <SummaryCard title={title}>{content}</SummaryCard> : content
}
