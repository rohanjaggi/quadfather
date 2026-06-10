'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAllWorkoutPRs, type WorkoutPR } from '@/lib/api'
import { EXERCISE_MUSCLES } from '@/lib/exercise-muscles'

const MUSCLE_TO_GROUP: Record<string, string> = {
  'pectoralis major': 'Chest',
  'latissimus dorsi': 'Back',
  'rhomboids': 'Back',
  'erector spinae': 'Back',
  'trapezius': 'Back',
  'lower trapezius': 'Back',
  'teres major': 'Back',
  'anterior deltoid': 'Shoulders',
  'lateral deltoid': 'Shoulders',
  'posterior deltoid': 'Shoulders',
  'rear deltoid': 'Shoulders',
  'external rotators': 'Shoulders',
  'biceps': 'Arms',
  'triceps': 'Arms',
  'brachialis': 'Arms',
  'forearms': 'Arms',
  'brachioradialis': 'Arms',
  'grip': 'Arms',
  'quadriceps': 'Legs',
  'quadriceps (VMO)': 'Legs',
  'hamstrings': 'Legs',
  'glutes': 'Legs',
  'gluteus medius': 'Legs',
  'calves': 'Legs',
  'gastrocnemius': 'Legs',
  'soleus': 'Legs',
  'adductors': 'Legs',
  'hip flexors': 'Legs',
  'hip abductors': 'Legs',
  'abdominals': 'Core',
  'rectus abdominis': 'Core',
  'obliques': 'Core',
  'transverse abdominis': 'Core',
  'lower back': 'Core',
  'core': 'Core',
}

const GROUP_ORDER = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Other']

function getMuscleGroup(exerciseName: string): string {
  const key = exerciseName.toLowerCase()
  const entry = EXERCISE_MUSCLES[key]
  if (!entry || entry.primary.length === 0) return 'Other'
  const primary = entry.primary[0]
  return MUSCLE_TO_GROUP[primary] ?? 'Other'
}

interface GroupedPRs {
  group: string
  prs: WorkoutPR[]
}

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

  const grouped: GroupedPRs[] = []
  for (const pr of prs) {
    const group = getMuscleGroup(pr.exercise_name)
    const existing = grouped.find(g => g.group === group)
    if (existing) {
      existing.prs.push(pr)
    } else {
      grouped.push({ group, prs: [pr] })
    }
  }
  grouped.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {grouped.map((section, si) => (
            <div key={section.group} className={`fade-up fade-up-${si + 1}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 500,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--tg-theme-hint-color)',
              }}>
                {section.group}
              </p>
              <div style={{
                borderRadius: '16px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                overflow: 'hidden',
              }}>
                {section.prs.map((pr, i) => (
                  <div
                    key={`${pr.exercise_name}-${i}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 18px',
                      borderBottom: i < section.prs.length - 1 ? '1px solid var(--surface-border)' : 'none',
                    }}
                  >
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
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
