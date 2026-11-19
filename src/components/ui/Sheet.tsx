'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '@/components/ui/icons'
import { useTelegramBack } from '@/components/telegram'

/**
 * Bottom sheet: slides up over a scrim, closes on scrim tap, Escape, or the
 * close button, and returns focus to whatever opened it.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const tgBack = useTelegramBack()

  // Telegram's back button closes the sheet before it leaves the page.
  useEffect(() => (open ? tgBack.attach(onClose) : undefined), [open, onClose, tgBack])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  // Portalled to <body>: inside a page the sheet sits in the page-entrance
  // wrapper's stacking context, where no z-index can lift it over the tab bar.
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'rgba(31,42,36,.32)', animation: 'scrimIn .2s ease both' }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxHeight: '88svh', overflowY: 'auto',
          background: 'var(--ground)', borderRadius: '24px 24px 0 0',
          padding: '10px 18px calc(22px + env(safe-area-inset-bottom))',
          boxShadow: '0 -12px 40px -12px rgba(31,42,36,.3)',
          animation: 'sheetUp .32s var(--ease-out-expo) both',
          outline: 'none',
        }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '0 auto 10px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 44, height: 44, marginRight: -8, border: 'none', background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}
          >
            <CloseIcon size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
