import type { CSSProperties, ReactNode } from 'react'

/**
 * Column style for a page that ends in a `BottomDock`: it fills the screen so
 * the dock rests at the bottom even when the page is short. 120px is the
 * vertical padding `<main>` has in layout.tsx (24 top + 96 bottom).
 */
export const dockedPageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: 'calc(100svh - 120px - env(safe-area-inset-bottom))',
}

/**
 * The thumb-reach action area, held just above the 68px tab bar. Sticky rather
 * than fixed, so it keeps its own space in the flow and never covers the last
 * row. The -28px margin lets its resting place (short page, or scrolled to the
 * end) match where it sticks, so it never jumps.
 */
export default function BottomDock({ children }: { children: ReactNode }) {
  return (
    <div data-dock style={{
      position: 'sticky',
      bottom: 'calc(68px + env(safe-area-inset-bottom))',
      zIndex: 30,
      marginTop: 'auto',
      marginBottom: -28,
      padding: '14px 0 16px',
      background: 'linear-gradient(to bottom, rgba(243, 238, 232, 0), var(--ground) 14px)',
    }}>
      {children}
    </div>
  )
}
