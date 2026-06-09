'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAllWorkoutPRs, type WorkoutPR } from '@/lib/api'

export default function PRHistoryPage() {
  const router = useRouter()
  const [prs, setPrs] = useState<WorkoutPR[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllWorkoutPRs()
      .then(data => setPrs(data.prs))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', padding: '4px',
            color: 'var(--tg-theme-text-color)', cursor: 'pointer',
            fontSize: '20px', lineHeight: 1,
          }}
        >
          ←
        </button>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 500,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--tg-theme-hint-color)', marginBottom: '5px',
          }}>Training</p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
            lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
          }}>PR History</h1>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)' }}>
            Loading...
          </p>
        </div>
      ) : prs.length === 0 ? (
        <div className="card fade-up fade-up-1">
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '13px',
            color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0',
          }}>
            No personal records yet
          </p>
        </div>
      ) : (
        <div className="card fade-up fade-up-1">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {prs.map((pr, i) => (
              <div key={`${pr.exercise_name}-${i}`}>
                {i > 0 && <div style={{ height: '1px', backgroundColor: 'var(--surface-border)', marginBottom: '12px' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: '14px',
                      fontWeight: 500, color: 'var(--tg-theme-text-color)', margin: 0,
                    }}>
                      {pr.exercise_name}
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px',
                      color: 'var(--tg-theme-hint-color)', margin: '2px 0 0 0',
                    }}>
                      {new Date(pr.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '16px',
                      fontWeight: 600, color: 'var(--accent)',
                    }}>
                      {pr.value}
                    </span>
                    <span style={{
                      display: 'block', fontFamily: 'var(--font-display)', fontSize: '9px',
                      fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--accent)', opacity: 0.7, marginTop: '2px',
                    }}>
                      {pr.type} PR
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
