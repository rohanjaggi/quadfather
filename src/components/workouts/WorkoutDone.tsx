'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WorkoutLog } from '@/types/workouts'
import { useUser } from '@/context/UserContext'
import WorkoutAnalysis from './WorkoutAnalysis'
import { formatKg, sessionVolume } from './format'

/** `POST /workouts` returns the row with the PRs it just detected (`lib/progress`). */
export type SavedWorkout = WorkoutLog & { prs?: { exercise: string; type: string; value: string }[] | null }

/** After "Finish workout": what was saved, any new records, then the coach's read. */
export default function WorkoutDone({ saved, onAnother }: { saved: SavedWorkout; onAnother: () => void }) {
  const { user } = useUser()
  // The record sweep plays at once; asking for coaching ends it, so the
  // shimmer is never a second moving gradient.
  const [sweep, setSweep] = useState(true)

  const prs = Array.isArray(saved.prs) ? saved.prs : []
  const sets = saved.exercises.reduce((n, ex) => n + ex.sets.length, 0)
  const volume = sessionVolume(saved)
  const stats = [
    `${saved.exercises.length} ${saved.exercises.length === 1 ? 'exercise' : 'exercises'}`,
    `${sets} ${sets === 1 ? 'set' : 'sets'}`,
    volume > 0 ? `${formatKg(volume)} lifted` : null,
    saved.calories_burned ? `${Math.round(saved.calories_burned)} kcal` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section className="card" aria-labelledby="done-title">
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Saved</p>
        <h2 id="done-title" style={{ margin: '2px 0 4px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{saved.name}</h2>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>{stats}</p>

        {prs.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{prs.length === 1 ? 'New record' : 'New records'}</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {prs.map((p, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0' }}>
                  <span style={{ minWidth: 0, fontSize: 15 }}>{p.exercise}</span>
                  {/* Plays once, when the class first lands. */}
                  <span className={sweep ? 'gradient-sweep' : undefined} style={{ flexShrink: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {String(p.value).replace(/(\d)kg\b/, '$1 kg')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 18 }}>
          <Link href="/workouts" className="btn-primary" style={{ textDecoration: 'none' }}>Done</Link>
          <button type="button" className="btn-ghost" onClick={onAnother}>Log another</button>
        </div>
      </section>

      <WorkoutAnalysis
        title={user?.has_api_key || saved.analysis ? 'How it went' : 'Muscles worked'}
        workoutId={saved.id}
        existingAnalysis={saved.analysis}
        exercises={saved.exercises}
        showMap
        hidePrs
        onRequest={() => setSweep(false)}
      />
    </div>
  )
}
