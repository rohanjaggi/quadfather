'use client'

import { useState, useEffect } from 'react'
import { analyseWorkout } from '@/lib/api'
import type { WorkoutAnalysis as AnalysisType } from '@/types/exercises'

interface WorkoutAnalysisProps {
  workoutId: number
  existingAnalysis?: AnalysisType | null
}

export default function WorkoutAnalysis({ workoutId, existingAnalysis }: WorkoutAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisType | null>(existingAnalysis ?? null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (existingAnalysis) {
      setAnalysis(existingAnalysis)
      return
    }
    setLoading(true)
    analyseWorkout(workoutId)
      .then(setAnalysis)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [workoutId, existingAnalysis])

  if (error || (!loading && !analysis)) return null

  if (loading) {
    return (
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginTop: '8px' }}>
        Analyzing...
      </p>
    )
  }

  if (!analysis) return null

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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {analysis.muscle_groups_hit.map(m => (
              <span key={m} style={{
                fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 500,
                padding: '3px 8px', borderRadius: '6px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-hint-color)', textTransform: 'capitalize',
              }}>
                {m}
              </span>
            ))}
          </div>
          {analysis.prs.length > 0 && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--accent)', marginBottom: '6px' }}>
              PR: {analysis.prs.map(p => `${p.exercise} — ${p.value}`).join(', ')}
            </p>
          )}
          {analysis.volume_comparison && (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '6px' }}>
              {analysis.volume_comparison}
            </p>
          )}
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-text-color)' }}>
            {analysis.takeaway}
          </p>
        </div>
      )}
    </div>
  )
}
