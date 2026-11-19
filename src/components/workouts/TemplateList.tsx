'use client'

import { deleteTemplate } from '@/lib/api'
import type { WorkoutTemplate } from '@/types/workouts'
import SwipeToDelete, { SwipeDeleteProvider } from '@/components/SwipeToDelete'
import SummaryCard from '@/components/dashboard/SummaryCard'
import { toast } from '@/components/ui/Toast'
import { ChevronRightIcon, PlusIcon } from '@/components/ui/icons'
import { ErrorRetry, RowsSkeleton, friendlyError } from './bits'
import { formatKey } from './format'

interface TemplateListProps {
  /** Owned by the page so the list and the logger share one fetch. */
  templates: WorkoutTemplate[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onStart: (template: WorkoutTemplate) => void
  onCreateNew: () => void
  onDeleted: (id: number) => void
  /** Day key of the last session logged from each template, when known. */
  lastDone: Map<number, string>
}

export default function TemplateList({ templates, loading, error, onRetry, onStart, onCreateNew, onDeleted, lastDone }: TemplateListProps) {
  // Rethrow after toasting so SwipeToDelete restores the row it hid.
  async function handleDelete(id: number) {
    try {
      await deleteTemplate(id)
    } catch (err) {
      toast(friendlyError(err, 'Couldn’t delete this template.'), { type: 'error' })
      throw err
    }
    onDeleted(id)
  }

  const newButton = (
    <button type="button" className="btn-ghost" onClick={onCreateNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: -14 }}>
      <PlusIcon size={18} /> New template
    </button>
  )

  return (
    <SummaryCard title="Templates">
      {loading ? (
        <RowsSkeleton rows={3} />
      ) : error ? (
        // A failed fetch used to look exactly like "you have no templates",
        // which sends people off to recreate templates they already have.
        <ErrorRetry message={error} onRetry={onRetry} />
      ) : (
        // No empty branch: with no templates the page drops this card and
        // offers "New template" in its start rows instead.
        <>
          <SwipeDeleteProvider>
            <ul style={{ listStyle: 'none', margin: '-6px 0 0', padding: 0 }}>
              {templates.map((t, i) => {
                const last = lastDone.get(t.id)
                const n = t.exercises.length
                return (
                  <li key={t.id} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <SwipeToDelete id={`template-${t.id}`} onDelete={() => handleDelete(t.id)}>
                      <button
                        type="button"
                        onClick={() => onStart(t)}
                        style={{
                          width: '100%', minHeight: 60, padding: '10px 0', border: 'none', background: 'var(--card)',
                          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: 'var(--ink)',
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                            {n} {n === 1 ? 'exercise' : 'exercises'}
                            {last && ` · last done ${formatKey(last, { day: 'numeric', month: 'short' })}`}
                          </span>
                        </span>
                        <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
                      </button>
                    </SwipeToDelete>
                  </li>
                )
              })}
            </ul>
          </SwipeDeleteProvider>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4, borderTop: '1px solid var(--line)', paddingTop: 4 }}>
            {newButton}
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Swipe left to delete</span>
          </div>
        </>
      )}
    </SummaryCard>
  )
}
