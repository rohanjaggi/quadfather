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

export interface ToastAction {
  label: string
  onClick: () => void
}

export function toast(
  message: string,
  opts?: { type?: 'error' | 'success'; action?: ToastAction; duration?: number },
) {
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
  // Sit above any pinned dock (meal composer, "Add a bottle", "Finish workout")
  // so the toast never covers the button the user is about to tap again.
  const dock = document.querySelector<HTMLElement>('[data-dock]')
  el.style.bottom = dock
    ? `${Math.max(0, window.innerHeight - dock.getBoundingClientRect().top) + 10}px`
    : 'calc(78px + env(safe-area-inset-bottom))'
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
  text.style.flex = '1'

  const children: Node[] = [icon, text]
  const action = opts?.action
  if (action) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = action.label
    btn.style.cssText = [
      'flex-shrink:0', 'min-height:36px', 'margin:-8px -8px -8px 4px', 'padding:0 12px',
      'border:none', 'border-radius:10px', 'background:transparent',
      // Only the button takes taps; the pill itself never blocks the page.
      'pointer-events:auto',
      'color:#8FD3AE', 'font:inherit', 'font-weight:700', 'cursor:pointer',
    ].join(';')
    btn.addEventListener('click', () => {
      hideToast()
      action.onClick()
    }, { once: true })
    children.push(btn)
  }
  el.replaceChildren(...children)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })

  if (timer) clearTimeout(timer)
  timer = setTimeout(hideToast, opts?.duration ?? (action ? 5000 : 3000))
}

/** Hides the toast now, and makes its action button untappable. */
export function hideToast() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!node) return
  node.style.opacity = '0'
  node.style.transform = 'translateY(8px)'
  node.querySelectorAll('button').forEach(b => { b.style.pointerEvents = 'none' })
}

// Lives in `@/lib/errors` now (it is not toast-specific and server code can use
// it too); re-exported here so existing `from '@/components/ui/Toast'` imports
// keep working.
export { errorMessage } from '@/lib/errors'
