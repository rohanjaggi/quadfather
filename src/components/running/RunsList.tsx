'use client'

import Link from 'next/link'
import SummaryCard from '@/components/dashboard/SummaryCard'
import RunCard, { RunRowsSkeleton } from './RunCard'
import type { StravaState } from './StravaSync'
import type { RunLog } from '@/types/running'

const RECENT_COUNT = 5

const muted: React.CSSProperties = { margin: 0, fontSize: 13, color: 'var(--muted)' }

/** The last few runs as rows; tapping one opens its details. */
export default function RunsList({
  runs,
  failed,
  onRetry,
  landedId,
  onOpen,
  strava,
}: {
  /** null while the first load is in flight. */
  runs: RunLog[] | null
  failed: boolean
  onRetry: () => void
  landedId: number | null
  onOpen: (run: RunLog) => void
  strava: StravaState
}) {
  const recent = runs?.slice(0, RECENT_COUNT) ?? []

  return (
    <SummaryCard
      title="Recent runs"
      action={
        <Link href="/running/history" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, margin: '-12px 0', fontSize: 15, fontWeight: 600, color: 'var(--action)', textDecoration: 'none' }}>
          All runs
        </Link>
      }
    >
      {failed && runs === null ? (
        <div>
          <p style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--ink)' }}>Couldn&apos;t load your runs.</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>Try again</button>
        </div>
      ) : runs === null ? (
        <RunRowsSkeleton />
      ) : recent.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
          No runs in the last month. Log one above and it shows up here.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', margin: '-4px 0 -8px', padding: 0 }}>
          {recent.map((run, i) => (
            <RunCard key={run.id} run={run} first={i === 0} landed={run.id === landedId} onOpen={onOpen} />
          ))}
        </ol>
      )}

      {strava.connected && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }} aria-live="polite">
          {strava.error ? (
            <p style={{ ...muted, color: 'var(--over)' }}>
              {strava.error}
              {strava.needsReconnect && (
                <>
                  {' '}
                  <Link href="/profile/strava" style={{ color: 'var(--action)', fontWeight: 600 }}>Reconnect Strava</Link>
                </>
              )}
            </p>
          ) : (
            <p style={muted}>
              {strava.syncing ? 'Syncing Strava…' : strava.lastSynced ? `Strava synced ${strava.lastSynced}` : 'Strava connected'}
            </p>
          )}
        </div>
      )}
    </SummaryCard>
  )
}
