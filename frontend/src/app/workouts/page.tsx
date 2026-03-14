import ComingSoon from '@/components/workouts/ComingSoon'

export default function WorkoutsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--tg-theme-text-color)' }}>
        Workouts
      </h1>
      <ComingSoon />
    </div>
  )
}
