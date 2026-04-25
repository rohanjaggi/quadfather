'use client'

import { useState, useCallback } from 'react'
import { getMealSuggestions } from '@/lib/api'
import { useUser } from '@/context/UserContext'
import type { MealSuggestion } from '@/types/api'

export default function MealSuggestions() {
  const { user, logFood } = useUser()

  const [expanded, setExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<MealSuggestion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggingIdx, setLoggingIdx] = useState<number | null>(null)

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMealSuggestions()
      setSuggestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleToggle() {
    if (!user?.has_api_key) return
    const next = !expanded
    setExpanded(next)
    if (next && !suggestions && !loading) {
      fetchSuggestions()
    }
  }

  async function handleLog(suggestion: MealSuggestion, idx: number) {
    setLoggingIdx(idx)
    await logFood({
      food_name: suggestion.name,
      calories: suggestion.calories,
      protein: suggestion.protein,
      carbohydrates: suggestion.carbohydrates,
      fats: suggestion.fats,
      source: 'ai-suggest',
    })
    setLoggingIdx(null)
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          padding: '0 0 10px 0',
          cursor: 'pointer',
        }}
      >
        <span className="label-caps" style={{ marginBottom: 0 }}>
          AI Suggestions
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--tg-theme-hint-color)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          display: 'inline-block',
        }}>
          ▾
        </span>
      </button>

      {!user?.has_api_key && (
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '12px',
          color: 'var(--tg-theme-hint-color)', padding: '4px 0',
        }}>
          Set up your AI API key in Settings to get suggestions.
        </p>
      )}

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  height: '72px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--tg-theme-bg-color)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  opacity: 0.4,
                }} />
              ))}
            </div>
          )}

          {error && (
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '12px',
              color: 'var(--accent-calories)', textAlign: 'center', padding: '8px 0',
            }}>
              {error}
            </p>
          )}

          {!loading && suggestions && suggestions.map((s, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '14px',
              backgroundColor: 'var(--tg-theme-bg-color)',
              gap: '10px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--tg-theme-text-color)',
                  marginBottom: '3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {s.name}
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--tg-theme-hint-color)',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {s.description}
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--tg-theme-hint-color)',
                }}>
                  {s.calories} kcal · {s.protein}g P · {s.carbohydrates}g C · {s.fats}g F
                </p>
              </div>
              <button
                onClick={() => handleLog(s, i)}
                disabled={loggingIdx !== null}
                className="btn-primary"
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  flexShrink: 0,
                }}
              >
                {loggingIdx === i ? '...' : '+ Log'}
              </button>
            </div>
          ))}

          {!loading && suggestions && (
            <button
              onClick={fetchSuggestions}
              className="btn-secondary"
              style={{
                alignSelf: 'center',
                padding: '8px 18px',
                borderRadius: '99px',
                fontSize: '11px',
                marginTop: '2px',
              }}
            >
              Refresh suggestions
            </button>
          )}
        </div>
      )}
    </div>
  )
}
