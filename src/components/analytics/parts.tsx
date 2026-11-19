'use client'

import type { ReactNode } from 'react'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { RefreshIcon } from '@/components/ui/icons'
import { dayKey } from '@/lib/day'
import { Axis, HEADROOM, PLOT_HEIGHT, barLayout } from './BarChart'
import { axisLabel, periodKeys, type Period } from './trends'

/** Card 1 of every domain: the period's number, then how it compares. */
export function HeadlineCard({
  title, value, unit, delta, goal, note,
}: {
  title: string
  value: string
  unit: string
  delta?: string | null
  goal?: { text: string; over: boolean } | null
  note?: ReactNode
}) {
  return (
    <SummaryCard title={title}>
      <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}>{value}</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--muted)' }}>{unit}</span>
      </p>
      {delta && <p style={{ margin: '12px 0 0', fontSize: 15, color: 'var(--ink)' }}>{delta}</p>}
      {goal && (
        <p style={{ margin: delta ? '2px 0 0' : '12px 0 0', fontSize: 15, color: goal.over ? 'var(--over)' : 'var(--muted)' }}>
          {goal.text}
        </p>
      )}
      {note && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>{note}</p>}
    </SummaryCard>
  )
}

export interface Row { label: ReactNode; value: ReactNode; sub?: ReactNode }

/** Supporting stats as list rows: label left, value right. */
export function StatList({ title, rows, children }: { title: string; rows: Row[]; children?: ReactNode }) {
  return (
    <SummaryCard title={title}>
      {children}
      <dl style={{ margin: 0 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
              padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)',
            }}
          >
            <dt style={{ fontSize: 15, color: 'var(--ink)' }}>{r.label}</dt>
            <dd style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)', textAlign: 'right' }}>
              {r.value}
              {r.sub && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>{r.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </SummaryCard>
  )
}

/** "Which metric" chips that sit inside a chart card. */
export function Chips<T extends string>({
  options, value, onChange, label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // Bleeds to the card edges so a long row scrolls instead of wrapping.
      style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px 14px', padding: '0 20px' }}
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className="btn-pill"
          data-active={o.value === value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          style={{ flexShrink: 0 }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>{children}</p>
}

const GHOST_BAR = 14

/**
 * No data yet: the period's chart drawn empty (its real axis, flat track bars,
 * the goal line where there is one) with the sentence over it. The drawing is
 * aria-hidden and has nothing to tap; the sentence is the content.
 */
export function EmptyCard({ period, goal }: { period: Period; goal?: number }) {
  const today = dayKey()
  const keys = periodKeys(period, today)
  const { gap, radius } = barLayout(keys.length)
  return (
    <section className="card">
      <div style={{ position: 'relative' }}>
        <div aria-hidden="true">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap, height: PLOT_HEIGHT }}>
            {keys.map(k => (
              <span key={k} style={{ flex: 1, height: GHOST_BAR, borderRadius: radius, background: 'var(--track)' }} />
            ))}
            {goal !== undefined && goal > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${100 / HEADROOM}%`, borderTop: '1.5px dashed var(--muted)', opacity: 0.7 }} />
            )}
          </div>
          <Axis bars={keys.map(k => ({ key: k, axis: axisLabel(k, keys.length, today), today: k === today }))} />
        </div>
        <p style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: PLOT_HEIGHT - GHOST_BAR,
          margin: 0, padding: '0 8px', display: 'grid', placeItems: 'center', textAlign: 'center',
          fontSize: 15, lineHeight: 1.45, color: 'var(--ink)',
        }}>
          Not enough data yet. Log a few days and trends appear here.
        </p>
      </div>
    </section>
  )
}

export function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="card">
      <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}>
        Couldn’t load your trends. Check your connection and try again.
      </p>
      <button type="button" className="btn-secondary" onClick={onRetry} style={{ width: '100%' }}>Try again</button>
    </section>
  )
}

const block = (w: number | string, h: number, mt = 0) => (
  <div style={{ width: w, height: h, marginTop: mt, borderRadius: 8, background: 'var(--track)' }} />
)

/** Quiet loading: the shape of a headline card and a chart card, no motion. */
export function TrendsSkeleton() {
  return (
    <div role="status" aria-label="Loading trends" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section className="card">
        {block(96, 14)}
        {block(150, 40, 16)}
        {block('70%', 14, 14)}
      </section>
      <section className="card">
        {block(180, 14)}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 132, marginTop: 16 }}>
          {[46, 70, 58, 82, 40, 64, 30].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '6px 6px 2px 2px', background: 'var(--track)' }} />
          ))}
        </div>
      </section>
    </div>
  )
}

/** The weekly (or 30-day) AI read. Same states as before, restyled. */
export function ReadCard({
  period, insight, loading, error, empty, updatedAt, onGenerate,
}: {
  period: Period
  insight: string | null
  loading: boolean
  error: string | null
  empty: boolean
  updatedAt: Date | null
  onGenerate: () => void
}) {
  const which = period === 7 ? 'this week’s' : 'this month’s'
  const title = period === 7 ? 'This week’s read' : 'This month’s read'
  return (
    <SummaryCard
      title={title}
      action={insight && !loading ? (
        <button
          type="button"
          className="btn-ghost"
          onClick={onGenerate}
          aria-label={`Refresh ${which} read`}
          style={{ minWidth: 44, padding: 10, margin: '-12px -12px -12px 0', display: 'grid', placeItems: 'center', alignSelf: 'center' }}
        >
          <RefreshIcon size={20} />
        </button>
      ) : undefined}
    >
      {loading ? (
        <div role="status">
          <div className="ai-shimmer" style={{ height: 92 }} />
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>Reading your last {period} days…</p>
        </div>
      ) : insight ? (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-line' }}>{insight}</p>
          {updatedAt && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Updated {updatedAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          )}
        </>
      ) : empty ? (
        <Note>Nothing logged in the last {period} days yet. Log a few meals and your read appears here.</Note>
      ) : error ? (
        <>
          <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}>{error}</p>
          <button type="button" className="btn-secondary" onClick={onGenerate} style={{ width: '100%' }}>Try again</button>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.5, color: 'var(--muted)' }}>
            A short read on your last {period} days of food, water and training, written from your own logs.
          </p>
          <button type="button" className="btn-primary" onClick={onGenerate}>Get {which} read</button>
        </>
      )}
    </SummaryCard>
  )
}
