'use client'

import { errorMessage, toast } from '@/components/ui/Toast'
import { toastWithUndo } from '@/components/ui/undo'
import { formatInt } from '@/lib/format'
import type { DeleteOpts } from '@/context/UserContext'
import type { FoodLog } from '@/types/api'

/** The one success toast for a log. Undo reverses it, and says so if that fails. */
export function toastLogged(message: string, undo: () => Promise<unknown>) {
  toastWithUndo(message, () => {
    undo().catch(err => toast(errorMessage(err, "Couldn't undo that. It's still logged.")))
  })
}

/** "Logged · 690 kcal", with Undo deleting that meal straight away. */
export function toastMealLogged(log: FoodLog, deleteFood: (id: number, opts?: DeleteOpts) => Promise<void>) {
  toastLogged(`Logged · ${formatInt(log.calories)} kcal`, () => deleteFood(log.id, { undoable: false }))
}
