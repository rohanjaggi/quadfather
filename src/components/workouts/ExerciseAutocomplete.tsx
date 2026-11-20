'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { searchExercises } from '@/lib/api'
import type { Exercise } from '@/types/exercises'

interface ExerciseAutocompleteProps {
  value: string
  onChange: (name: string, exerciseId: number | null) => void
  placeholder?: string
  /**
   * Fired when the exercise is *committed* — picked from the catalogue or the
   * field blurred with something typed. Consumers use this to avoid acting on
   * every keystroke (e.g. the paid prediction call).
   */
  onCommit?: (name: string, exerciseId: number | null) => void
  /**
   * Reports whether the current text is a real catalogue exercise — picked from
   * the dropdown, or typed out to an exact match of a search result. Consumers
   * use it to keep half-typed names (`'ben'`) out of paid endpoints.
   */
  onResolvedChange?: (resolved: boolean) => void
  /** Accessible name for the field (there is no visible label beside it). */
  label?: string
  /** Defaults to true: an exercise row can't be saved without a name. */
  required?: boolean
  autoFocus?: boolean
  inputStyle?: CSSProperties
}

export default function ExerciseAutocomplete({
  value, onChange, placeholder, onCommit, onResolvedChange,
  label = 'Exercise name', required = true, autoFocus, inputStyle,
}: ExerciseAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Exercise[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const blurTimerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
    // A field the parent cleared shouldn't reopen on stale matches.
    if (!value) setResults([])
  }, [value])

  // Neither a pending search nor the blur close-timer may fire after the field
  // is gone (removing an exercise row unmounts this mid-gesture).
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
  }, [])

  function handleInput(text: string) {
    setQuery(text)
    onChange(text, null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.length < 2) {
      setResults([])
      setOpen(false)
      onResolvedChange?.(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchExercises(text)
        setResults(data)
        setOpen(data.length > 0)
        // Typing a catalogue name out in full counts as resolved, even without
        // tapping the dropdown row.
        const typed = text.trim().toLowerCase()
        onResolvedChange?.(data.some(ex => ex.name.trim().toLowerCase() === typed))
      } catch {
        setResults([])
        onResolvedChange?.(false)
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  function handleSelect(exercise: Exercise) {
    setQuery(exercise.name)
    onChange(exercise.name, exercise.id)
    onResolvedChange?.(true)
    onCommit?.(exercise.name, exercise.id)
    setOpen(false)
  }

  function handleBlur() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => setOpen(false), 150)
    const trimmed = query.trim()
    if (trimmed) onCommit?.(trimmed, null)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        className="input-field"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        onBlur={handleBlur}
        placeholder={placeholder ?? 'Exercise name'}
        aria-label={label}
        autoComplete="off"
        autoFocus={autoFocus}
        required={required}
        style={{ width: '100%', ...inputStyle }}
      />
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            maxHeight: 220, overflowY: 'auto', marginTop: 6, padding: '4px 0',
            background: 'var(--card)', borderRadius: 'var(--radius-control)',
            border: '1px solid var(--line)', boxShadow: 'var(--shadow-raised)',
          }}
        >
          {results.map(ex => (
            <button
              key={ex.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(ex)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                width: '100%', minHeight: 44, padding: '10px 14px', border: 'none',
                background: 'transparent', textAlign: 'left', color: 'var(--ink)',
              }}
            >
              <span style={{ fontSize: 15 }}>{ex.name}</span>
              <span style={{ flexShrink: 0, fontSize: 13, color: 'var(--muted)' }}>
                {ex.category ? ex.category.charAt(0).toUpperCase() + ex.category.slice(1).toLowerCase() : ''}
              </span>
            </button>
          ))}
          {loading && (
            <p style={{ margin: 0, padding: '8px 14px', fontSize: 13, color: 'var(--muted)' }}>Searching…</p>
          )}
        </div>
      )}
    </div>
  )
}
