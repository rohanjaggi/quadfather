'use client'

import { useState, useEffect, useMemo } from 'react'
import { analyseWorkout } from '@/lib/api'
import type { WorkoutAnalysis as AnalysisType } from '@/types/exercises'
import type { ExerciseLogEntry } from '@/types/workouts'
import MuscleMap from './MuscleMap'
import { calculateMuscleIntensities, intensitiesFromMuscleNames } from '@/lib/muscle-intensity'
import { useUser } from '@/context/UserContext'

interface WorkoutAnalysisProps {
  workoutId: number
  existingAnalysis?: AnalysisType | null
  exercises?: ExerciseLogEntry[]
}

export default function WorkoutAnalysis({ workoutId, existingAnalysis, exercises }: WorkoutAnalysisProps) {
  const { user } = useUser()
  const [analysis, setAnalysis] = useState<AnalysisType | null>(existingAnalysis ?? null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (existingAnalysis) {
      setAnalysis(existingAnalysis)
      return
    }
    setLoading(true)
    analyseWorkout(workoutId)
      .then(setAnalysis)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workoutId, existingAnalysis])

  const intensities = useMemo(() => {
    if (exercises && exercises.length > 0) {
      const result = calculateMuscleIntensities(exercises)
      if (Object.keys(result).length > 0) return result
    }
    if (analysis?.muscle_groups_hit) {
      return intensitiesFromMuscleNames(analysis.muscle_groups_hit)
    }
    return {}
  }, [exercises, analysis])

  const hasContent = Object.keys(intensities).length > 0 || analysis

  if (!hasContent && !loading) return null

  if (loading && !hasContent) {
    return (
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginTop: '8px' }}>
        Analyzing...
      </p>
    )
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
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
        </div>
      )}
    </div>
  )
}
