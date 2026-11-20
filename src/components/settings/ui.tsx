'use client'

import Link from 'next/link'
import { Children, Fragment, useCallback, useRef, useState, type ReactNode } from 'react'
import Sheet from '@/components/ui/Sheet'
import { CheckIcon, ChevronRightIcon } from '@/components/ui/icons'

// Shared pieces for Settings and its subpages: grouped rows, labelled number
// fields, the pinned save bar, radio rows, and the destructive confirm sheet.

const divider = (inset = 0) => (
  <div aria-hidden="true" style={{ height: 1, background: 'var(--line)', marginLeft: inset }} />
)

/** iOS-settings group: a small muted title over one card of rows. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const rows = Children.toArray(children)
  return (
    <section>
      <h2 style={{ margin: '0 4px 8px', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{title}</h2>
      <div className="card" style={{ padding: 0 }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && divider(54)}
            {row}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

/** One 52px row: icon, label, current value, chevron. */
export function SettingsLink({ href, icon, label, value }: {
  href: string
  icon: ReactNode
  label: string
  value?: ReactNode
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, minHeight: 52, padding: '0 14px 0 18px',
        color: 'var(--ink)', textDecoration: 'none', outlineOffset: -2,
      }}
    >
      <span style={{ display: 'grid', color: 'var(--muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}>{label}</span>
      {value != null && (
        <span style={{ maxWidth: '48%', fontSize: 15, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </span>
      )}
      <ChevronRightIcon size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </Link>
  )
}

/** A card of form fields with a card title. */
export function FormCard({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="card" style={{ scrollMarginTop: 16 }}>
      <h2 className="card-title" style={{ margin: '0 0 14px' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  )
}

/**
 * A labelled number input with its unit inside the field. The error shows once
 * the user has left the field (never mid-typing, never for a field they haven't
 * reached yet), or straight away for a filled-in value that's out of range.
 */
export function NumberField({ id, label, unit, value, onChange, error, decimal }: {
  id: string
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  error: string | null
  decimal?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const show = !!error && !focused && (touched || value.trim() !== '')
  return (
    <div>
      <label htmlFor={id} className="label-caps">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTouched(true) }}
          aria-invalid={show || undefined}
          aria-describedby={show ? `${id}-error` : undefined}
          className="input-field"
          style={{ paddingRight: 22 + unit.length * 9, borderColor: show ? 'var(--over)' : undefined }}
        />
        <span aria-hidden="true" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)', pointerEvents: 'none' }}>
          {unit}
        </span>
      </div>
      {show && (
        <p id={`${id}-error`} style={{ margin: '6px 2px 0', fontSize: 13, color: 'var(--over)' }}>{error}</p>
      )}
    </div>
  )
}

/** Plain-words error line. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: 'var(--over)' }}>{children}</p>
  )
}

/**
 * The form's one primary action. Disabled while the form is clean or invalid;
 * pinned above the tab bar once there is something to save.
 */
export function SaveBar({ dirty, invalid, saving, label, error }: {
  dirty: boolean
  invalid?: boolean
  saving: boolean
  label: string
  error?: string | null
}) {
  return (
    <div
      style={{
        position: dirty ? 'sticky' : 'static',
        // Button bottom lands 84px up: clear of the 68px tab bar with a 16px gap
        // that the solid band covers, so rows never show through underneath.
        bottom: 'calc(68px + env(safe-area-inset-bottom))',
        zIndex: 5,
        padding: '14px 0 16px',
        background: dirty ? 'linear-gradient(to bottom, rgba(243, 238, 232, 0), var(--ground) 14px)' : undefined,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {error && <FormError>{error}</FormError>}
      <button type="submit" className="btn-primary" disabled={!dirty || invalid || saving}>
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}

/** Radio rows: label, optional hint below, a check on the chosen one. */
export function ChoiceList<T extends string>({ label, options, value, onChange }: {
  label: string
  options: { value: T; label: string; hint?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={e => {
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
        if (!step) return
        e.preventDefault()
        const i = options.findIndex(o => o.value === value)
        const next = options[(i + step + options.length) % options.length]
        onChange(next.value)
        const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
        radios[options.indexOf(next)]?.focus()
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <Fragment key={o.value}>
            {i > 0 && divider()}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (i === 0 && !options.some(x => x.value === value)) ? 0 : -1}
              onClick={() => onChange(o.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52,
                padding: '8px 0', border: 'none', background: 'transparent', textAlign: 'left',
                color: 'var(--ink)', outlineOffset: -2,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: on ? 600 : 500 }}>{o.label}</span>
                {o.hint && <span style={{ display: 'block', marginTop: 1, fontSize: 13, color: 'var(--muted)' }}>{o.hint}</span>}
              </span>
              <span style={{ width: 22, display: 'grid', color: 'var(--action)', flexShrink: 0 }}>
                {on && <CheckIcon size={20} />}
              </span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

/** Destructive confirm: says what happens, one brick button, and a way out. */
export function ConfirmSheet({ open, onClose, title, body, confirmLabel, busyLabel, busy, error, onConfirm }: {
  open: boolean
  onClose: () => void
  title: string
  body: ReactNode
  confirmLabel: string
  busyLabel: string
  busy: boolean
  error?: string | null
  onConfirm: () => void
}) {
  // Sheet re-runs its focus/scroll-lock effect whenever `onClose` changes, so
  // hand it one stable function that reads the latest props.
  const latest = useRef({ onClose, busy })
  latest.current = { onClose, busy }
  const close = useCallback(() => { if (!latest.current.busy) latest.current.onClose() }, [])

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: '0 0 8px', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}>{body}</p>
        {error && <FormError>{error}</FormError>}
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          disabled={busy}
          style={{ background: 'var(--over)', boxShadow: 'none' }}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={close} disabled={busy} style={{ width: '100%' }}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}

/** "Lightly Active" → "Lightly active": the shared label maps are title case. */
export function sentence(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase()
}
