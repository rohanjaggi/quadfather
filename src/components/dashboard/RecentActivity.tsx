'use client'

import type { FoodLog, WaterLog } from '@/types/api'
import type { WorkoutLog } from '@/types/workouts'

interface ActivityItem {
  id: string
  type: 'food' | 'water' | 'workout'
  label: string
  detail: string
  time: string
  timestamp: number
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function mergeActivity(foodLogs: FoodLog[], waterLogs: WaterLog[], workoutLogs: WorkoutLog[]): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const log of foodLogs) {
    items.push({
      id: `food-${log.id}`,
      type: 'food',
      label: log.food_name,
      detail: `${Math.round(log.calories)} kcal`,
      time: formatTime(log.logged_at),
      timestamp: new Date(log.logged_at).getTime(),
    })
  }

  for (const log of waterLogs) {
    items.push({
      id: `water-${log.id}`,
      type: 'water',
      label: `${log.amount_liters.toFixed(1)}L water`,
      detail: log.bottles ? `${log.bottles} bottle${log.bottles !== 1 ? 's' : ''}` : '',
      time: formatTime(log.logged_at),
      timestamp: new Date(log.logged_at).getTime(),
    })
  }

  for (const log of workoutLogs) {
    const exerciseCount = log.exercises.length
    items.push({
      id: `workout-${log.id}`,
      type: 'workout',
      label: log.name,
      detail: `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`,
      time: formatTime(log.logged_at),
      timestamp: new Date(log.logged_at).getTime(),
    })
  }

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8)
}

const typeConfig = {
  food: {
    color: 'var(--accent-calories)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2v6a3 3 0 0 0 6 0V2" /><path d="M12 8v14" /><line x1="9" y1="2" x2="9" y2="6" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="15" y1="2" x2="15" y2="6" />
      </svg>
    ),
  },
  water: {
    color: 'var(--accent-water)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
  },
  workout: {
    color: 'var(--accent-protein)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" /><path d="M12 6.5v11" /><rect x="2" y="8.5" width="4" height="7" rx="1" /><rect x="18" y="8.5" width="4" height="7" rx="1" />
      </svg>
    ),
  },
}

export default function RecentActivity({
  foodLogs,
  waterLogs,
  workoutLogs = [],
}: {
  foodLogs: FoodLog[]
  waterLogs: WaterLog[]
  workoutLogs?: WorkoutLog[]
}) {
  const items = mergeActivity(foodLogs, waterLogs, workoutLogs)

  if (items.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--font-display)' }}>
        <p style={{
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '14px',
        }}>
          Recent
        </p>
        <p style={{
          fontSize: '14px',
          color: 'var(--tg-theme-hint-color)',
          textAlign: 'center',
          padding: '24px 0',
        }}>
          Nothing logged yet today
        </p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'var(--font-display)' }}>
      <p style={{
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--tg-theme-hint-color)',
        marginBottom: '14px',
      }}>
        Recent
      </p>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {items.map((item) => {
          const config = typeConfig[item.type]
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: config.color,
                flexShrink: 0,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '9px',
                  backgroundColor: config.color,
                  opacity: 0.12,
                }} />
                {config.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--tg-theme-text-color)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}>
                  {item.label}
                </p>
                <p style={{
                  fontSize: '11px',
                  color: 'var(--tg-theme-hint-color)',
                  marginTop: '1px',
                }}>
                  {item.detail}
                </p>
              </div>

              <span style={{
                fontSize: '11px',
                color: 'var(--tg-theme-hint-color)',
                flexShrink: 0,
              }}>
                {item.time}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
