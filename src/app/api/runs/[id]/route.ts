import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser, parseJsonBody, requireInt, notFound, unprocessable } from '@/lib/api-handler'

type Ctx = { params: { id: string } }

export const PATCH = withUser<Ctx>(async (request, user, { params }) => {
  const id = requireInt(params.id, 'id')
  const body = await parseJsonBody(request)

  if (typeof body.added_to_allowance !== 'boolean') {
    throw unprocessable('added_to_allowance must be a boolean')
  }

  const run = await prisma.runLog.findFirst({ where: { id, user_id: user.id } })
  if (!run) throw notFound('Run not found')

  const updated = await prisma.runLog.update({
    where: { id: run.id },
    data: { added_to_allowance: body.added_to_allowance },
  })

  return NextResponse.json({
    ...updated,
    strava_activity_id: updated.strava_activity_id?.toString() ?? null,
  })
})

export const DELETE = withUser<Ctx>(async (request, user, { params }) => {
  const id = requireInt(params.id, 'id')

  const run = await prisma.runLog.findFirst({ where: { id, user_id: user.id } })
  if (!run) throw notFound('Run not found')

  await prisma.runLog.delete({ where: { id: run.id } })

  // Tombstone: without it the next `POST /api/runs/sync` re-imports the very
  // activity the user just deleted (the sync window always reaches back at
  // least 30 days). Best-effort — a failure here must not fail the delete.
  if (run.strava_activity_id !== null) {
    try {
      await prisma.stravaIgnoredActivity.upsert({
        where: {
          user_id_strava_activity_id: {
            user_id: user.id,
            strava_activity_id: run.strava_activity_id,
          },
        },
        update: {},
        create: { user_id: user.id, strava_activity_id: run.strava_activity_id },
      })
    } catch (err) {
      console.error('Failed to record Strava tombstone for run', run.id, err)
    }
  }

  return new NextResponse(null, { status: 204 })
})
