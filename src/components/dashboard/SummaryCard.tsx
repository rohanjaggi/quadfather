import { ReactNode } from 'react'

export default function SummaryCard({
  title,
  action,
  children,
}: {
  title?: ReactNode
  /** Optional right-aligned control in the title row (e.g. a "See all" link). */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card">
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          {title && <h2 className="card-title" style={{ margin: 0 }}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
