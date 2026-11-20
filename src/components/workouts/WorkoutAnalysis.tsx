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
 * `/analyse` is a paid LLM call, made only when the user taps for it. The same
 * session can be on screen twice in a row (the finish screen, then the
 * Training tab's "Last session"). These live for the page session so the
 * second mount shows or joins the first answer instead of paying again.
 */
const results = new Map<number, AnalysisType>()
const inFlight = new Map<number, Promise<AnalysisType>>()

interface WorkoutAnalysisProps {
  workoutId: number
  existingAnalysis?: AnalysisType | null
  exercises?: ExerciseLogEntry[]
  /** Draw the muscle map for this session. */
  showMap?: boolean
  /** The finish screen lists new records itself, from the save response. */
  hidePrs?: boolean
  /** Fires when the analysis starts loading (the finish screen ends its record sweep). */
  onRequest?: () => void
  /** Wrap in a card with this title (and render nothing, not an empty card, when there's nothing). */
  title?: string
}

export default function WorkoutAnalysis({
  workoutId, existingAnalysis, exercises, showMap = false, hidePrs = false, onRequest, title,
}: WorkoutAnalysisProps) {
  const { user } = useUser()
  const [analysis, setAnalysis] = useState<AnalysisType | null>(existingAnalysis ?? results.get(workoutId) ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intensities, setIntensities] = useState<Record<MuscleZone, number>>({} as Record<MuscleZone, number>)

  const hasKey = user?.has_api_key === true
  const requested = useRef(onRequest)
  requested.current = onRequest

  const runAnalysis = useCallback(async () => {
    requested.current?.()
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
    }
  }, [workoutId])

  // Never requests on its own: shows a stored or earlier answer, or joins one
  // another mount already asked for.
  useEffect(() => {
    const known = existingAnalysis ?? results.get(workoutId)
    if (known) setAnalysis(known)
    else if (inFlight.has(workoutId)) runAnalysis()
  }, [workoutId, existingAnalysis, runAnalysis])

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
    body = <ErrorRetry message={error} onRetry={runAnalysis} />
  } else if (hasKey) {
    // No key means every request 4xxs, so the button only shows with one.
    body = (
      <button type="button" className="btn-secondary" onClick={runAnalysis}>
        Get coaching on this session
      </button>
    )
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
