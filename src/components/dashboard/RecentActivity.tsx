'use client'

import type { FoodLog, WaterLog } from '@/types/api'

interface ActivityItem {
  id: string
  type: 'food' | 'water'
  label: string
  detail: string
  time: string
  timestamp: number
}

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function mergeActivity(foodLogs: FoodLog[], waterLogs: WaterLog[]): ActivityItem[] {
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

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)
}

export default function RecentActivity({
  foodLogs,
  waterLogs,
}: {
  foodLogs: FoodLog[]
  waterLogs: WaterLog[]
}) {
  const items = mergeActivity(foodLogs, waterLogs)

  if (items.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--font-display)' }}>
        <p style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.08em',
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
        borderRadius: '16px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        overflow: 'hidden',
      }}>
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--surface-border)',
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              backgroundColor: item.type === 'food' ? 'var(--accent-calories)' : 'var(--accent-water)',
              flexShrink: 0,
            }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--tg-theme-text-color)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </p>
            </div>

            <span style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--tg-theme-hint-color)',
              flexShrink: 0,
            }}>
              {item.detail}
            </span>

            <span style={{
              fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
              opacity: 0.6,
              flexShrink: 0,
            }}>
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
