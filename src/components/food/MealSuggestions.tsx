'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { getMealSuggestions } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import { toast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { formatInt } from '@/lib/format'
import { macroLine } from '@/components/food/meals'
import { ChevronDownIcon, RefreshIcon } from '@/components/ui/icons'
import type { MealSuggestion } from '@/types/api'

const caption: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--muted)' }

/** AI meal ideas that fit the rest of today's budget; collapsed until asked. */
export default function MealSuggestions() {
  const { user, logFood } = useUser()

  const [expanded, setExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<MealSuggestion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggingIdx, setLoggingIdx] = useState<number | null>(null)
  // Index of the open idea. Cleared whenever the list is refetched — it used to
  // survive a refresh, so slot 2 of the *new* batch opened itself.
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    setOpenIdx(null)
    try {
      setSuggestions(await getMealSuggestions())
    } catch (err) {
      setError(errorMessage(err, "Couldn't find ideas right now."))
    } finally {
      setLoading(false)
    }
  }, [])

  function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !suggestions && !loading) fetchSuggestions()
  }

  // Success is announced by the Food page when the new row lands.
  async function handleLog(s: MealSuggestion, idx: number) {
    if (loggingIdx !== null) return
    setLoggingIdx(idx)
    try {
      await logFood({
        food_name: s.name,
        calories: s.calories,
        protein: s.protein,
        carbohydrates: s.carbohydrates,
        fats: s.fats,
        fiber: s.fiber,
        source: 'ai-suggest',
      })
    } catch (err) {
      toast(errorMessage(err, `Could not log ${s.name}`))
    } finally {
      setLoggingIdx(null)
    }
  }

  if (!user?.has_api_key) {
    return (
      <section className="card">
        <h2 className="card-title" style={{ margin: 0 }}>Ideas for what&apos;s left</h2>
        <p style={{ ...caption, marginTop: 6 }}>
          Add an AI key to get meal ideas that fit the rest of your day.{' '}
          <Link href="/profile/api-key" style={{ color: 'var(--action)', fontWeight: 600, textDecoration: 'none' }}>Add a key</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="card" style={{ paddingTop: 6, paddingBottom: expanded ? 14 : 6 }}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        style={{
          width: '100%', minHeight: 48, padding: 0, border: 'none', background: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink)',
        }}
      >
        <span className="card-title">Ideas for what&apos;s left</span>
        <span style={{ display: 'grid', color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .25s var(--ease-out-expo)' }}>
          <ChevronDownIcon size={20} />
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 4 }}>
          {loading && (
            <div role="status">
              <div className="ai-shimmer" style={{ height: 96 }} aria-hidden="true" />
              <p style={{ ...caption, marginTop: 8 }}>Finding meals that fit what&apos;s left…</p>
            </div>
          )}

          {!loading && error && (
            <div>
              <p role="alert" style={caption}>{error}</p>
              <button type="button" className="btn-ghost" onClick={fetchSuggestions} style={{ marginLeft: -14 }}>Try again</button>
            </div>
          )}

          {!loading && !error && suggestions && suggestions.length === 0 && (
            <p style={caption}>No ideas this time. Try again in a bit.</p>
          )}

          {!loading && !error && suggestions && suggestions.map((s, i) => {
            const open = openIdx === i
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  style={{ flex: 1, minWidth: 0, minHeight: 44, padding: 0, border: 'none', background: 'none', textAlign: 'left', color: 'var(--ink)' }}
                >
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, ...(open ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
                    {s.name}
                  </span>
                  <span style={{ ...caption, display: 'block', marginTop: 2 }}>
                    {formatInt(s.calories)} kcal · {macroLine(s, open)}
                  </span>
                  {open && s.description && <span style={{ ...caption, display: 'block', marginTop: 8, color: 'var(--ink)' }}>{s.description}</span>}
                  {open && s.reason && <span style={{ ...caption, display: 'block', marginTop: 6 }}>{s.reason}</span>}
                </button>
                <button
                  type="button"
                  className="btn-pill"
                  data-active="true"
                  onClick={() => handleLog(s, i)}
                  disabled={loggingIdx !== null}
                  aria-label={`Log ${s.name}`}
                  style={{ flexShrink: 0, minHeight: 40 }}
                >
                  {loggingIdx === i ? 'Logging…' : 'Log'}
                </button>
              </div>
            )
          })}

          {!loading && !error && suggestions && (
            <button
              type="button"
              className="btn-ghost"
              onClick={fetchSuggestions}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: -14, marginTop: 2 }}
            >
              <RefreshIcon size={18} /> Different ideas
            </button>
          )}
        </div>
      )}
    </section>
  )
}
