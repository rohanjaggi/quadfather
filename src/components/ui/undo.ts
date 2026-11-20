'use client'

import { hideToast, toast } from '@/components/ui/Toast'

export const UNDO_MS = 5000

type Pending = { commit: () => void; timer: ReturnType<typeof setTimeout> }
const pending = new Map<number, Pending>()
let seq = 0

function flush() {
  if (pending.size === 0) return
  for (const [id, p] of pending) {
    clearTimeout(p.timer)
    pending.delete(id)
    p.commit()
  }
  // The deletes are sent; an Undo left on screen would be a lie.
  hideToast()
}

// The app can be closed or backgrounded inside the undo window; commit right
// away then, while the page can still finish a request, so a delete the user
// meant is never silently dropped.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}

/**
 * Shows `message` with an Undo button for 5s. `commit` runs when the window
 * closes (or the app is hidden); `undo` runs instead if the user taps Undo.
 * Callers apply the change to the UI optimistically before calling this.
 */
export function deferWithUndo({ message, commit, undo }: { message: string; commit: () => void; undo: () => void }) {
  const id = ++seq
  const timer = setTimeout(() => {
    if (!pending.delete(id)) return
    commit()
  }, UNDO_MS)
  pending.set(id, { commit, timer })
  toast(message, {
    type: 'success',
    duration: UNDO_MS,
    action: {
      label: 'Undo',
      onClick: () => {
        const p = pending.get(id)
        if (!p) return
        clearTimeout(p.timer)
        pending.delete(id)
        undo()
      },
    },
  })
}

/** For a log that already happened: Undo reverses it straight away. */
export function toastWithUndo(message: string, undo: () => void) {
  toast(message, { type: 'success', duration: UNDO_MS, action: { label: 'Undo', onClick: undo } })
}
