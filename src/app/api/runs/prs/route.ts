import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUser } from '@/lib/api-handler'
import { formatPace, formatDuration } from '@/lib/format'

export const GET = withUser(async (request, user) => {
  const runs = await prisma.runLog.findMany({
    where: { user_id: user.id },
    orderBy: { run_date: 'desc' },
  })

  if (runs.length === 0) {
    return NextResponse.json({ prs: [] })
  }

  const prs: { label: string; value: string; detail: string; date: string }[] = []

  const fastestPace = runs
    .filter(r => r.pace_per_km && r.distance_meters >= 1000)
    .sort((a, b) => (a.pace_per_km ?? 99) - (b.pace_per_km ?? 99))[0]

  if (fastestPace?.pace_per_km) {
    prs.push({
      label: 'Fastest Pace',
      // `pace_per_km` is decimal minutes (`duration/60 / distance/1000`), hence
      // the 'min' unit. The hand-rolled floor/round pair here could emit `5:60`.
      value: formatPace(fastestPace.pace_per_km, 'min'),
      detail: `/km (${(fastestPace.distance_meters / 1000).toFixed(1)}km run)`,
      date: new Date(fastestPace.run_date).toISOString().split('T')[0],
    })
  }

  const longest = [...runs].sort((a, b) => b.distance_meters - a.distance_meters)[0]
  if (longest) {
    prs.push({
      label: 'Longest Run',
      value: `${(longest.distance_meters / 1000).toFixed(2)}`,
      detail: `km in ${Math.floor(longest.duration_seconds / 60)}min`,
      date: new Date(longest.run_date).toISOString().split('T')[0],
    })
  }

  const fiveKRuns = runs.filter(r => r.distance_meters >= 4900 && r.distance_meters <= 5200)
  if (fiveKRuns.length > 0) {
    const fastest5k = [...fiveKRuns].sort((a, b) => a.duration_seconds - b.duration_seconds)[0]
    prs.push({
      label: 'Fastest 5K',
      value: formatDuration(fastest5k.duration_seconds),
      detail: `(${(fastest5k.distance_meters / 1000).toFixed(2)}km)`,
      date: new Date(fastest5k.run_date).toISOString().split('T')[0],
    })
  }

  const tenKRuns = runs.filter(r => r.distance_meters >= 9800 && r.distance_meters <= 10200)
  if (tenKRuns.length > 0) {
    const fastest10k = [...tenKRuns].sort((a, b) => a.duration_seconds - b.duration_seconds)[0]
    prs.push({
      label: 'Fastest 10K',
      value: formatDuration(fastest10k.duration_seconds),
      detail: `(${(fastest10k.distance_meters / 1000).toFixed(2)}km)`,
      date: new Date(fastest10k.run_date).toISOString().split('T')[0],
    })
  }

  return NextResponse.json({ prs })
})
