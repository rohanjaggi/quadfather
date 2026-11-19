'use client'

import { useEffect, useState, useRef } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { getWorkoutRecap } from '@/lib/api'
import { AiWorking, ErrorRetry, friendlyError } from './bits'

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
  const requestId = useRef(0)

  function fetchRecap() {
    setLoading(true)
    setError(null)
    const id = ++requestId.current
    getWorkoutRecap(period)
      .then(data => {
        if (requestId.current !== id) return
        setRecap(data.recap)
        cachedPeriod.current = period
        cachedCount.current = workoutCount
      })
      // `err.message` is the raw `API 500: {"detail":"…"}` thrown by `apiFetch`;
      // `errorMessage` unwraps it to the part worth showing.
      .catch(err => { if (requestId.current === id) setError(friendlyError(err, 'Couldn’t write your recap just now.')) })
      .finally(() => { if (requestId.current === id) setLoading(false) })
  }

  useEffect(() => {
    requestId.current++ // drop any in-flight response for the previous period
    setLoading(false)
    setError(null)
    if (cachedPeriod.current !== period || cachedCount.current !== workoutCount) {
      setRecap(null)
    }
  }, [period, workoutCount])

  if (workoutCount === 0) return null

  const span = period === 7 ? 'week' : '30 days'

  return (
    <SummaryCard title="Training recap">
      {loading ? (
        <AiWorking label={`Reading your last ${span}…`} height={72} />
      ) : recap ? (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-line' }}>{recap}</p>
          <button type="button" className="btn-ghost" onClick={fetchRecap} style={{ marginTop: 6, marginLeft: -14 }}>
            Write a fresh one
          </button>
        </>
      ) : error ? (
        <ErrorRetry message={error} onRetry={fetchRecap} />
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--muted)' }}>
            A short read on your last {span} of training, written from your own sessions.
          </p>
          <button type="button" className="btn-secondary" onClick={fetchRecap}>Get my recap</button>
        </>
      )}
    </SummaryCard>
  )
}
