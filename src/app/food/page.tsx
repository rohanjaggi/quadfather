'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import SummaryCard from '@/components/dashboard/SummaryCard'
import Sheet from '@/components/ui/Sheet'
import BottomDock, { dockedPageStyle } from '@/components/food/BottomDock'
import MealComposer, { COMPOSER_INPUT_ID, PHOTO_INPUT_ID } from '@/components/food/MealComposer'
import MealList from '@/components/food/MealList'
import ManualFoodForm from '@/components/food/ManualFoodForm'
import MealSuggestions from '@/components/food/MealSuggestions'
import LogAgainCard, { type LogAgainTab } from '@/components/food/LogAgainCard'
import WaterCard from '@/components/water/WaterCard'
import { useLandedMeal } from '@/components/food/useLandedMeal'
import { useUser } from '@/context/UserContext'
import { formatInt } from '@/lib/format'
import { ChevronRightIcon } from '@/components/ui/icons'

// `useSearchParams` needs a Suspense boundary or `next build` fails.
export default function FoodPage() {
  return (
    <Suspense fallback={null}>
      <Food />
    </Suspense>
  )
}

function Food() {
  const router = useRouter()
  const mode = useSearchParams().get('mode')
  const { user, summary, foodLogs, deleteFood } = useUser()
  const [manualOpen, setManualOpen] = useState(false)
  const [againRequest, setAgainRequest] = useState<{ tab: LogAgainTab } | null>(null)
  const openManual = useCallback(() => setManualOpen(true), [])
  const closeManual = useCallback(() => setManualOpen(false), [])
  const landedId = useLandedMeal(foodLogs)

  // Deep links from the Log sheet, handled once and then dropped from the URL
  // so Back or a re-render can't replay them.
  useEffect(() => {
    if (!mode) return
    if (mode === 'photo') document.getElementById(PHOTO_INPUT_ID)?.click()
    else if (mode === 'describe') document.getElementById(COMPOSER_INPUT_ID)?.focus()
    else if (mode === 'again' || mode === 'saved') setAgainRequest({ tab: mode === 'saved' ? 'saved' : 'recent' })
    else if (mode === 'manual') setManualOpen(true)
    router.replace('/food', { scroll: false })
  }, [mode, router])

  let subtitle: React.ReactNode
  if (summary) {
    const { calories, protein } = summary.macros
    const left = Math.round((summary.budget?.total ?? calories.goal) - calories.total)
    const proteinToGo = Math.round(protein.goal - protein.total)
    subtitle = (
      <>
        {left >= 0
          ? `${formatInt(left)} kcal left`
          : <span style={{ color: 'var(--over)' }}>over by {formatInt(-left)} kcal</span>}
        {' · '}
        {proteinToGo > 0 ? `${formatInt(proteinToGo)} g protein to go` : 'protein done'}
      </>
    )
  }

  return (
    <div style={dockedPageStyle}>
      <PageHeader
        title="Food"
        subtitle={subtitle}
        // Without a key the dock's "Enter a meal manually" is the one manual path.
        action={user?.has_api_key && (
          <button type="button" className="btn-ghost" onClick={openManual} style={{ color: 'var(--action)', marginRight: -14, marginTop: -6 }}>
            Enter manually
          </button>
        )}
      />

      <SummaryCard
        title="Today's meals"
        action={
          <Link href="/food/history" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '12px 0', margin: '-12px 0', fontSize: 15, fontWeight: 600, color: 'var(--action)', textDecoration: 'none' }}>
            Past days <ChevronRightIcon size={16} />
          </Link>
        }
      >
        {foodLogs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
            {user?.has_api_key
              ? 'Nothing logged yet today. Describe or snap your first meal below.'
              : 'Nothing logged yet today. Enter your first meal below.'}
          </p>
        ) : (
          // Undoable: the row leaves at once and the toast offers Undo.
          <MealList logs={foodLogs} landedId={landedId} onDelete={deleteFood} />
        )}
      </SummaryCard>

      <LogAgainCard requested={againRequest} />
      <WaterCard />
      <MealSuggestions />

      <BottomDock>
        <MealComposer onManual={openManual} />
      </BottomDock>

      <Sheet open={manualOpen} onClose={closeManual} title="Enter manually">
        <ManualFoodForm onClose={closeManual} />
      </Sheet>
    </div>
  )
}
