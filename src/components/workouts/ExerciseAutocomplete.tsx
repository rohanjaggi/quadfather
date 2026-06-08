'use client'

import { useState, useEffect, useRef } from 'react'
import { searchExercises } from '@/lib/api'
import type { Exercise } from '@/types/exercises'

interface ExerciseAutocompleteProps {
  value: string
  onChange: (name: string, exerciseId: number | null) => void
  placeholder?: string
}

export default function ExerciseAutocomplete({ value, onChange, placeholder }: ExerciseAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Exercise[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  function handleInput(text: string) {
    setQuery(text)
    onChange(text, null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (text.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchExercises(text)
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  function handleSelect(exercise: Exercise) {
    setQuery(exercise.name)
    onChange(exercise.name, exercise.id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <input
        className="input-field"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? 'Exercise name'}
        required
        style={{ width: '100%' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          maxHeight: '180px', overflowY: 'auto',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          borderRadius: '12px', marginTop: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid var(--surface-border)',
        }}>
          {results.map(ex => (
            <button
              key={ex.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelect(ex)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '10px 14px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-text-color)' }}>
                {ex.name}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {ex.category}
              </span>
            </button>
          ))}
          {loading && (
            <p style={{ padding: '8px 14px', fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
              Searching...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
