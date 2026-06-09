'use client'

import { useEffect, useState, useRef } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { getWorkoutRecap } from '@/lib/api'

interface Props {
  period: 7 | 30
  workoutCount: number
}

export default function TrainingRecap({ period, workoutCount }: Props) {
  const [recap, setRecap] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cachedPeriod = useRef<number | null>(null)
  const cachedCount = useRef<number | null>(null)

  function fetchRecap() {
    setLoading(true)
    setError(null)
    getWorkoutRecap(period)
      .then(data => {
        setRecap(data.recap)
        cachedPeriod.current = period
        cachedCount.current = workoutCount
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to generate recap'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (cachedPeriod.current !== period || cachedCount.current !== workoutCount) {
      setRecap(null)
    }
  }, [period, workoutCount])

  if (workoutCount === 0) return null

  return (
    <SummaryCard title="AI Training Recap">
      {recap ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '14px',
            lineHeight: '1.6', color: 'var(--tg-theme-text-color)',
          }}>
            {recap}
          </p>
          <button
            onClick={fetchRecap}
            disabled={loading}
            style={{
              alignSelf: 'center', background: 'none',
              border: '1px solid var(--surface-border)', padding: '8px 18px',
              borderRadius: '99px', fontFamily: 'var(--font-display)',
              fontSize: '11px', color: 'var(--tg-theme-hint-color)', cursor: 'pointer',
            }}
          >
            Regenerate
          </button>
        </div>
      ) : loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{
            width: '20px', height: '20px', margin: '0 auto 10px',
            border: '2px solid var(--surface-border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            color: 'var(--tg-theme-hint-color)',
          }}>
            Analyzing your {period}-day training...
          </p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            color: 'var(--accent-calories)', marginBottom: '10px',
          }}>
            {error}
          </p>
          <button
            onClick={fetchRecap}
            style={{
              background: 'none', border: '1px solid var(--surface-border)',
              padding: '8px 18px', borderRadius: '99px',
              fontFamily: 'var(--font-display)', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)', cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px',
            color: 'var(--tg-theme-hint-color)', marginBottom: '12px',
          }}>
            Get AI-powered feedback on your {period}-day training
          </p>
          <button
            onClick={fetchRecap}
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 24px', borderRadius: '99px', fontSize: '12px' }}
          >
            Get Recap
          </button>
        </div>
      )}
    </SummaryCard>
  )
}
