'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAllWorkoutPRs, type WorkoutPR } from '@/lib/api'
import { loadExerciseMuscles } from '@/lib/muscle-intensity'
import { prDisplayDate, prDisplayValue, prTypeLabel } from '@/components/workouts/pr-display'

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

type ExerciseMuscleMap = Record<string, { primary: string[]; secondary: string[] }>

function getMuscleGroup(muscleMap: ExerciseMuscleMap | null, exerciseName: string): string {
  if (!muscleMap) return 'Other'
  const key = exerciseName.toLowerCase()
  const entry = muscleMap[key]
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
  // ~100 KB of exercise→muscle data, fetched alongside the PRs rather than
  // bundled into this page's first load.
  const [muscleMap, setMuscleMap] = useState<ExerciseMuscleMap | null>(null)

  useEffect(() => {
    let cancelled = false
    // Settled, not all: the muscle chunk is a 100 KB optional nicety, and
    // failing it used to take the whole PR list down with it. Without the map
    // every PR simply falls into the 'Other' group.
    Promise.allSettled([getAllWorkoutPRs(), loadExerciseMuscles()])
      .then(([prsResult, musclesResult]) => {
        if (cancelled) return
        if (prsResult.status === 'fulfilled') setPrs(prsResult.value.prs)
        else console.error('Failed to load PRs:', prsResult.reason)
        if (musclesResult.status === 'fulfilled') setMuscleMap(musclesResult.value)
        else console.error('Failed to load exercise muscles:', musclesResult.reason)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const grouped: GroupedPRs[] = []
  for (const pr of prs) {
    const group = getMuscleGroup(muscleMap, pr.exercise_name)
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
          aria-label="Go back"
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
                    <div style={{ minWidth: 0, marginRight: '12px' }}>
                      <p style={{
                        fontFamily: 'var(--font-display)', fontSize: '14px',
                        fontWeight: 500, color: 'var(--tg-theme-text-color)', margin: 0,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {pr.exercise_name}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-display)', fontSize: '11px',
                        color: 'var(--tg-theme-hint-color)', margin: '2px 0 0 0',
                      }}>
                        {prDisplayDate(pr)}
                      </p>
                    </div>
                    {/* `value` is now pre-formatted ("100kg × 5"), so keep it
                        intact and let the exercise name truncate instead. */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: '16px',
                        fontWeight: 600, color: 'var(--accent)',
                      }}>
                        {prDisplayValue(pr)}
                      </span>
                      <span style={{
                        display: 'block', fontFamily: 'var(--font-display)', fontSize: '9px',
                        fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--accent)', opacity: 0.7, marginTop: '2px',
                      }}>
                        {prTypeLabel(pr)}
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
