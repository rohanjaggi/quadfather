export default function SummaryCard({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
      borderRadius: '20px',
      padding: '20px',
    }}>
      {title && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: '18px',
        }}>
          {title}
        </p>
      )}
      {children}
    </div>
  )
}
