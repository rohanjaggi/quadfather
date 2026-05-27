import { ReactNode } from 'react'

export default function SummaryCard({
  title,
  children,
}: {
  title?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="card">
      {title && (
        <div className="label-caps" style={{ letterSpacing: '0.1em', marginBottom: '18px' }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}
