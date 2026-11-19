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
  const accent = opts?.type === 'success' ? '#8FD3AE' : '#F2A48F'  // light tints that read on the ink pill

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
      'display:flex',
      'align-items:center',
      'gap:10px',
      'padding:13px 16px',
      'border-radius:16px',
      'background-color:var(--ink, #1F2A24)',
      'color:#FFFFFF',
      'font-family:var(--font-display, system-ui, sans-serif)',
      'font-size:15px',
      'font-weight:500',
      'line-height:1.35',
      'box-shadow:0 10px 30px -10px rgba(31, 42, 36, 0.45)',
      'pointer-events:none',
      'opacity:0',
      'transform:translateY(8px)',
      'transition:opacity 0.2s ease, transform 0.2s var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1))',
    ].join(';')
    document.body.appendChild(node)
  }

  const el = node
  // Status is carried by an icon plus the words, never by colour alone.
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('width', '18')
  icon.setAttribute('height', '18')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('fill', 'none')
  icon.setAttribute('stroke', accent)
  icon.setAttribute('stroke-width', '2.2')
  icon.setAttribute('stroke-linecap', 'round')
  icon.setAttribute('aria-hidden', 'true')
  icon.style.flexShrink = '0'
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', opts?.type === 'success' ? 'M5 12.5l4.5 4.5L19 7.5' : 'M12 7v6M12 17h.01')
  icon.appendChild(path)
  const text = document.createElement('span')
  text.textContent = message
  el.replaceChildren(icon, text)
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
