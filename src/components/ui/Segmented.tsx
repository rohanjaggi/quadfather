'use client'

/**
 * The one segmented control (replaces the three toggle styles the critique
 * found). A radio group: arrow keys move, the selected option is pressed.
 */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: 'flex', padding: 3, gap: 2, borderRadius: 14, background: 'var(--track)' }}
      onKeyDown={e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
        const i = options.findIndex(o => o.value === value)
        const next = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length]
        onChange(next.value)
      }}
    >
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1, minHeight: 36, padding: '6px 10px', border: 'none', borderRadius: 11,
              background: on ? 'var(--card)' : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(31,42,36,.1)' : 'none',
              color: on ? 'var(--ink)' : 'var(--muted)',
              fontSize: 14, fontWeight: 600,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
