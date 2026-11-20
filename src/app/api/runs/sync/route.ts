import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, badRequest, conflict } from '@/lib/api-handler'
import { DEFAULT_BODYWEIGHT_KG } from '@/lib/constants'
import {
  getValidStravaToken,
  fetchAllStravaActivities,
  stravaActivityToRunData,
  hasActivityReadScope,
} from '@/lib/strava'

const DAY_MS = 24 * 60 * 60 * 1000

/** Re-scan before the last sync: a watch can upload days late; imported ones are filtered by `strava_activity_id`. */
const SYNC_OVERLAP_MS = 7 * DAY_MS

/**
 * Floor for every sync (and the first backfill window). The Running page auto-syncs and bumps
 * `strava_last_synced_at` even when nothing imports, so the cursor alone would make older
 * backdated activities unreachable. Costs 1-2 Strava pages; re-seen activities are filtered.
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

  // Cursor is the last successful sync, not the newest run_date; never narrower than FIRST_SYNC_LOOKBACK_MS.
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
        // Tombstones for runs deleted here: the scan reaches back 30+ days, so they'd reappear.
        prisma.stravaIgnoredActivity.findMany({
          where: { user_id: user.id, strava_activity_id: { in: candidateIds } },
          select: { strava_activity_id: true },
        }),
      ])
    : empty
  // Both sides are stringified BigInts; raw JSON numbers lose precision past 2^53.
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
    // Explicit because the budget reads it; synced runs are credited like manual ones.
    newRuns.push({
      user_id: user.id,
      added_to_allowance: true,
      ...stravaActivityToRunData(activity, user.weight_kg ?? DEFAULT_BODYWEIGHT_KG),
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
