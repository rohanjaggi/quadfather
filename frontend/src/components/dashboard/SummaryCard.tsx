export default function SummaryCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--tg-theme-secondary-bg-color)' }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--tg-theme-hint-color)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}
