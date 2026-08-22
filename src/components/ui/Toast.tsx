'use client'

/**
 * Provider-free, imperative toast.
 *
 * Renders a single fixed-position element created lazily on the first call;
 * repeat calls replace the message and restart the ~3s dismiss timer, so no
 * stack ever builds up. Safe to call during SSR (no-op without `document`).
 */

let node: HTMLDivElement | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export function toast(message: string, opts?: { type?: 'error' | 'success' }) {
  if (typeof document === 'undefined' || !message) return
  const accent = opts?.type === 'success' ? 'var(--accent-protein)' : 'var(--accent-calories)'

  if (!node || !node.isConnected) {
    node = document.createElement('div')
    node.setAttribute('role', 'status')
    node.setAttribute('aria-live', 'polite')
    node.style.cssText = [
      'position:fixed',
      'left:16px',
      'right:16px',
      'bottom:calc(78px + env(safe-area-inset-bottom))',
      'margin:0 auto',
      'max-width:420px',
      'z-index:9999',
      'padding:11px 14px',
      'border-radius:12px',
      'background-color:var(--tg-theme-secondary-bg-color, #EBE8E4)',
      'color:var(--tg-theme-text-color, #1A1614)',
      'font-family:var(--font-display, system-ui, sans-serif)',
      'font-size:13px',
      'line-height:1.4',
      'box-shadow:0 4px 20px rgba(28, 20, 16, 0.14)',
      'pointer-events:none',
      'opacity:0',
      'transform:translateY(8px)',
      'transition:opacity 0.2s ease, transform 0.2s var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1))',
    ].join(';')
    document.body.appendChild(node)
  }

  const el = node
  el.textContent = message
  el.style.borderLeft = `3px solid ${accent}`
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(8px)'
  }, 3000)
}

// Lives in `@/lib/errors` now (it is not toast-specific and server code can use
// it too); re-exported here so existing `from '@/components/ui/Toast'` imports
// keep working.
export { errorMessage } from '@/lib/errors'
