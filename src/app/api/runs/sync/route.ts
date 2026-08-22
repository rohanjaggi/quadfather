import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, badRequest, conflict } from '@/lib/api-handler'
import {
  getValidStravaToken,
  fetchAllStravaActivities,
  stravaActivityToRunData,
  hasActivityReadScope,
} from '@/lib/strava'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How far back before the last successful sync we re-scan Strava.
 * A watch can upload an activity days after it happened, so starting exactly
 * at the previous sync time would silently skip late uploads. Anything already
 * imported is filtered out below by `strava_activity_id`.
 */
const SYNC_OVERLAP_MS = 7 * DAY_MS

/**
 * Floor for every sync (also the first-ever backfill window). The Running page
 * auto-syncs on mount and bumps `strava_last_synced_at` even when nothing is
 * imported, so for a regular user the overlap cursor above collapses to
 * "the last 7 days" — an activity dated further back (manual entry, a watch
 * upload backdated by more than a week) would then never be reachable again.
 * Scanning at least this far back on every sync costs 1–2 Strava pages and the
 * `strava_activity_id` filter below makes the re-seen activities free.
 */
const FIRST_SYNC_LOOKBACK_MS = 30 * DAY_MS

export const POST = withUser(async (request, user) => {
  if (!user.strava_access_token) {
    throw badRequest('Strava not connected')
  }

  if (!hasActivityReadScope(user.strava_scope)) {
    throw conflict('Strava not connected with activity read scope — reconnect')
  }

  const token = await getValidStravaToken(user)

  // Cursor is based on the last successful sync (a real UTC timestamp), NOT on
  // run_date — run_date stores Strava's `start_date_local` wall clock, which
  // runs ahead of UTC and made later-in-the-day runs permanently unreachable.
  // Never scan a window narrower than FIRST_SYNC_LOOKBACK_MS, so late/backdated
  // uploads stay reachable no matter how often the app auto-syncs.
  const lastSyncedAt = user.strava_last_synced_at
  const afterMs = Math.min(
    lastSyncedAt ? lastSyncedAt.getTime() - SYNC_OVERLAP_MS : Infinity,
    Date.now() - FIRST_SYNC_LOOKBACK_MS,
  )
  const after = Math.floor(afterMs / 1000)

  const activities = await fetchAllStravaActivities(token, after)

  // One query for every candidate id instead of a findUnique per activity.
  const candidateIds = activities.map(a => BigInt(a.id))
  const empty: [{ strava_activity_id: bigint | null }[], { strava_activity_id: bigint }[]] = [[], []]
  const [existing, ignored] = candidateIds.length
    ? await Promise.all([
        prisma.runLog.findMany({
          where: { user_id: user.id, strava_activity_id: { in: candidateIds } },
          select: { strava_activity_id: true },
        }),
        // Activities the user deleted from Quadfather. The scan window always
        // reaches back at least 30 days, so without these tombstones a deleted
        // run comes straight back on the next sync.
        prisma.stravaIgnoredActivity.findMany({
          where: { user_id: user.id, strava_activity_id: { in: candidateIds } },
          select: { strava_activity_id: true },
        }),
      ])
    : empty
  // Both sides of the comparison are stringified BigInts — stringifying the raw
  // JSON number instead would lose precision on ids beyond 2^53.
  const known = new Set([
    ...existing.map(r => r.strava_activity_id?.toString() ?? ''),
    ...ignored.map(r => r.strava_activity_id.toString()),
  ])

  const newRuns: Array<
    { user_id: number; added_to_allowance: boolean } & ReturnType<typeof stravaActivityToRunData>
  > = []
  activities.forEach((activity, i) => {
    const key = candidateIds[i].toString()
    if (known.has(key)) return
    known.add(key) // guards against the same activity appearing twice in the fetch
    // `added_to_allowance` explicit rather than relying on the column default:
    // the budget calculation reads it, and a synced run should be credited
    // exactly like a manually logged one.
    newRuns.push({
      user_id: user.id,
      added_to_allowance: true,
      ...stravaActivityToRunData(activity),
    })
  })

  const synced = newRuns.length
    ? (await prisma.runLog.createMany({ data: newRuns, skipDuplicates: true })).count
    : 0

  const now = new Date()
  await prisma.user.update({
    where: { id: user.id },
    data: { strava_last_synced_at: now },
  })

  return NextResponse.json({
    synced,
    skipped_deleted: ignored.length,
    total_fetched: activities.length,
    last_synced_at: now.toISOString(),
  })
})
