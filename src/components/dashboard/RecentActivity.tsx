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

function FoodDot() {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      backgroundColor: 'var(--accent-calories)',
      flexShrink: 0,
    }} />
  )
}

function WaterDot() {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      backgroundColor: 'var(--accent-water)',
      flexShrink: 0,
    }} />
  )
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
      <div className="card">
        <p className="label-caps" style={{ letterSpacing: '0.1em', marginBottom: '14px' }}>
          Recent Activity
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--tg-theme-hint-color)',
          textAlign: 'center',
          padding: '12px 0',
        }}>
          Nothing logged yet today
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="label-caps" style={{ letterSpacing: '0.1em', marginBottom: '14px' }}>
        Recent Activity
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              paddingBottom: i === items.length - 1 ? 0 : '12px',
              marginBottom: i === items.length - 1 ? 0 : '12px',
              borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--surface-border)',
            }}
          >
            {item.type === 'food' ? <FoodDot /> : <WaterDot />}

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--tg-theme-text-color)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </p>
              {item.detail && (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--tg-theme-hint-color)',
                  marginTop: '2px',
                }}>
                  {item.detail}
                </p>
              )}
            </div>

            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
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
