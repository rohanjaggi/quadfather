export default function SummaryCard({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="card">
      {title && (
        <p className="label-caps" style={{ letterSpacing: '0.1em', marginBottom: '18px' }}>
          {title}
        </p>
      )}
      {children}
    </div>
  )
}
