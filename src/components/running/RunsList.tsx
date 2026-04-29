'use client'

import { useUser } from '@/context/UserContext'
import RunCard from './RunCard'
import SummaryCard from '@/components/dashboard/SummaryCard'

export default function RunsList() {
  const { runLogs, deleteRun, toggleRunAllowance } = useUser()

  return (
    <SummaryCard title="Today's Runs">
      {runLogs.length === 0 ? (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--tg-theme-hint-color)',
          textAlign: 'center',
          padding: '16px 0',
        }}>
          No runs logged yet
        </p>
      ) : (
        <div>
          {runLogs.map((run, i) => (
            <RunCard
              key={run.id}
              run={run}
              onToggle={toggleRunAllowance}
              onDelete={deleteRun}
              isLast={i === runLogs.length - 1}
            />
          ))}
        </div>
      )}
    </SummaryCard>
  )
}
