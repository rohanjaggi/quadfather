export default function ComingSoon() {
  return (
    <div
      className="fade-up fade-up-1"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        padding: '52px 28px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        borderRadius: '20px',
        textAlign: 'center',
      }}
    >
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: '44px',
        fontWeight: 400,
        fontStyle: 'italic',
        color: 'var(--tg-theme-text-color)',
        lineHeight: 1.1,
      }}>
        Coming soon
      </p>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        color: 'var(--tg-theme-hint-color)',
        lineHeight: 1.7,
        maxWidth: '260px',
      }}>
        Log workouts with natural language. Track sets, reps, and weight — with muscle-group heatmaps.
      </p>
    </div>
  )
}
