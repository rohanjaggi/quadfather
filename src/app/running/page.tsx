'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import { toast } from '@/components/ui/Toast'
import { toastWithUndo } from '@/components/ui/undo'
import { useHaptic } from '@/components/telegram'
import { useUser } from '@/context/UserContext'
import { getRunHistory } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import ThisWeekCard from '@/components/running/BurnSummary'
import RunningPRs from '@/components/running/RunningPRs'
import RunsList from '@/components/running/RunsList'
import LogRunSheet from '@/components/running/LogRunSheet'
import RunDetailsSheet from '@/components/running/RunDetailsSheet'
import { formatKm } from '@/components/running/RunCard'
import { useStravaSync } from '@/components/running/StravaSync'
import type { RunLog } from '@/types/running'

/** `/running?log=1` (the Log sheet's Run row) opens the log sheet on arrival. */
function OpenLogFromLink({ onOpen }: { onOpen: () => void }) {
  const wantsLog = useSearchParams().get('log') === '1'
  const router = useRouter()
  useEffect(() => {
    if (!wantsLog) return
    onOpen()
    // Drop the flag so a later tap on the same link changes the URL again.
    router.replace('/running', { scroll: false })
  }, [wantsLog]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function RunningPage() {
  const { runLogs, deleteRun } = useUser()
  const haptic = useHaptic()
  const strava = useStravaSync()

  // The last month of runs feeds "Recent runs" and the week's best pace.
  // Refetched whenever the context's runs change (log, delete, toggle, sync).
  const [recent, setRecent] = useState<RunLog[] | null>(null)
  const [recentFailed, setRecentFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    getRunHistory(30)
      .then(runs => { if (!cancelled) { setRecent(runs); setRecentFailed(false) } })
      .catch(() => { if (!cancelled) setRecentFailed(true) })
    return () => { cancelled = true }
  }, [runLogs, attempt])

  // Deleted runs wait out their Undo window on the server, so the refetch that
  // the delete itself triggers would bring them straight back. Hide them here;
  // Undo and a failed server delete both un-hide via onListChange(run, false).
  const [hidden, setHidden] = useState<number[]>([])
  const shown = recent && recent.filter(r => !hidden.includes(r.id))
  const onListChange = useCallback((run: RunLog, removed: boolean) => {
    setHidden(h => (removed ? [...h, run.id] : h.filter(id => id !== run.id)))
  }, [])

  const [logOpen, setLogOpen] = useState(false)
  const [openRun, setOpenRun] = useState<RunLog | null>(null)

  // Landing: ids on screen when the sheet opened; after a log, the first run
  // not among them is the new one and gets the wash, once.
  const recentRef = useRef(recent)
  recentRef.current = recent
  const idsAtOpen = useRef<Set<number>>(new Set())
  const [awaitLand, setAwaitLand] = useState(false)
  const [landedId, setLandedId] = useState<number | null>(null)

  const openLog = useCallback(() => {
    idsAtOpen.current = new Set((recentRef.current ?? []).map(r => r.id))
    setAwaitLand(false)
    setLogOpen(true)
  }, [])
  const closeLog = useCallback(() => setLogOpen(false), [])
  const closeDetails = useCallback(() => setOpenRun(null), [])

  useEffect(() => {
    if (!awaitLand || !recent) return
    const fresh = recent.find(r => !idsAtOpen.current.has(r.id))
    if (!fresh) return
    setAwaitLand(false)
    setLandedId(fresh.id)
  }, [awaitLand, recent])

  useEffect(() => {
    if (landedId == null) return
    const t = setTimeout(() => setLandedId(null), 2000)
    return () => clearTimeout(t)
  }, [landedId])

  function handleLogged(run: RunLog) {
    haptic.notification('success')
    toastWithUndo(`Run logged · ${formatKm(run.distance_meters)}`, () => {
      deleteRun(run.id, { undoable: false }).catch(err => toast(errorMessage(err, "Couldn't undo. The run is still logged.")))
    })
    setAwaitLand(true)
    setLogOpen(false)
  }

  async function handleStravaSync() {
    setLogOpen(false)
    const result = await strava.sync()
    if (!result) {
      haptic.notification('error')
      toast("Strava didn't sync. Try again in a moment.")
      return
    }
    if (result.synced > 0) {
      haptic.notification('success')
      setAwaitLand(true)
      toast(`${result.synced} new ${result.synced === 1 ? 'run' : 'runs'} from Strava`, { type: 'success' })
    } else {
      toast('Strava is up to date', { type: 'success' })
    }
  }

  // No runs this month: the week card already says so and holds "Log a run", so
  // the empty Recent runs card goes. It stays while Strava is connected, since
  // it carries the sync status and the reconnect link.
  const noRuns = shown?.length === 0 && !strava.connected

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader title="Runs" back={{ href: '/workouts', label: 'Training' }} />

      <ThisWeekCard runs={shown} onLog={openLog} allRunsLink={noRuns} />

      {!noRuns && (
        <RunsList
          runs={shown}
          failed={recentFailed}
          onRetry={() => setAttempt(a => a + 1)}
          landedId={landedId}
          onOpen={setOpenRun}
          strava={strava}
        />
      )}

      <RunningPRs />

      <Suspense fallback={null}>
        <OpenLogFromLink onOpen={openLog} />
      </Suspense>

      <LogRunSheet
        open={logOpen}
        onClose={closeLog}
        onLogged={handleLogged}
        onStravaSync={handleStravaSync}
        strava={strava}
      />
      <RunDetailsSheet run={openRun} onClose={closeDetails} onListChange={onListChange} />
    </div>
  )
}
