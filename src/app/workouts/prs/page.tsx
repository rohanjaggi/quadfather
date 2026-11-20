'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllWorkoutPRs, type WorkoutPR } from '@/lib/api'
import { loadExerciseMuscles } from '@/lib/muscle-intensity'
import PageHeader from '@/components/ui/PageHeader'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { prDisplayDate, prDisplayValue, prEstimated1RM } from '@/components/workouts/pr-display'
import { ErrorRetry, RowsSkeleton, friendlyError } from '@/components/workouts/bits'

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

export default function RecordsPage() {
  const [prs, setPrs] = useState<WorkoutPR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // ~100 KB of exercise→muscle data, fetched alongside the PRs rather than
  // bundled into this page's first load.
  const [muscleMap, setMuscleMap] = useState<ExerciseMuscleMap | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    // Settled, not all: the muscle chunk is a 100 KB optional nicety, and
    // failing it used to take the whole PR list down with it. Without the map
    // every PR simply falls into the 'Other' group.
    Promise.allSettled([getAllWorkoutPRs(), loadExerciseMuscles()])
      .then(([prsResult, musclesResult]) => {
        if (cancelled) return
        if (prsResult.status === 'fulfilled') {
          setPrs(prsResult.value.prs)
        } else {
          console.error('Failed to load PRs:', prsResult.reason)
          // Used to fall through to "No personal records yet", which isn't true.
          setError(friendlyError(prsResult.reason, 'Couldn’t load your records.'))
        }
        if (musclesResult.status === 'fulfilled') setMuscleMap(musclesResult.value)
        else console.error('Failed to load exercise muscles:', musclesResult.reason)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [attempt])

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        title="Records"
        subtitle="Your heaviest set for each lift."
        back={{ href: '/workouts', label: 'Training' }}
      />

      {loading ? (
        <SummaryCard><RowsSkeleton rows={4} /></SummaryCard>
      ) : error ? (
        <SummaryCard><ErrorRetry message={error} onRetry={() => setAttempt(n => n + 1)} /></SummaryCard>
      ) : prs.length === 0 ? (
        <SummaryCard>
          <p style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--muted)' }}>
            No records yet. Log a weighted set and your best lifts collect here.
          </p>
          <Link href="/workouts/log" className="btn-primary" style={{ textDecoration: 'none' }}>Start a workout</Link>
        </SummaryCard>
      ) : (
        grouped.map(section => (
          <SummaryCard key={section.group} title={section.group}>
            <ul style={{ listStyle: 'none', margin: '-8px 0 -6px', padding: 0 }}>
              {section.prs.map((pr, i) => {
                const e1rm = prEstimated1RM(pr)
                return (
                  <li
                    key={`${pr.exercise_name}-${i}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.exercise_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{prDisplayDate(pr)}</p>
                    </div>
                    {/* `value` is pre-formatted ("100kg × 5"): keep it whole and let the name truncate. */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{prDisplayValue(pr)}</p>
                      {e1rm !== null && (
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>est. 1RM {e1rm} kg</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </SummaryCard>
        ))
      )}
    </div>
  )
}
