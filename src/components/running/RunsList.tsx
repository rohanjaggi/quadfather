'use client'

import { useUser } from '@/context/UserContext'
import RunCard from './RunCard'
import SummaryCard from '@/components/dashboard/SummaryCard'
import SwipeToDelete, { SwipeDeleteProvider } from '@/components/SwipeToDelete'

export default function RunsList() {
  const { runLogs, deleteRun } = useUser()

  return (
    <SummaryCard title="Today's Runs">
      {runLogs.length === 0 ? (
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          color: 'var(--tg-theme-hint-color)',
          textAlign: 'center',
          padding: '16px 0',
        }}>
          No runs logged yet
        </p>
      ) : (
        <SwipeDeleteProvider>
          {runLogs.map((run, i) => (
            <SwipeToDelete key={run.id} id={`run-${run.id}`} onDelete={() => deleteRun(run.id)}>
              <RunCard
                run={run}
                isLast={i === runLogs.length - 1}
              />
            </SwipeToDelete>
          ))}
        </SwipeDeleteProvider>
      )}
    </SummaryCard>
  )
}
