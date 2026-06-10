'use client'

import { useState, useEffect } from 'react'
import { getTemplates, deleteTemplate } from '@/lib/api'
import type { WorkoutTemplate } from '@/types/workouts'
import SwipeToDelete, { SwipeDeleteProvider } from '@/components/SwipeToDelete'

interface TemplateListProps {
  onCreateNew: () => void
}

export default function TemplateList({ onCreateNew }: TemplateListProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: number) {
    await deleteTemplate(id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-theme-hint-color)' }}>
          My Templates
        </p>
        <button onClick={onCreateNew} style={{
          background: 'none', border: 'none', fontFamily: 'var(--font-display)',
          fontSize: '11px', color: 'var(--tg-theme-button-color)', cursor: 'pointer',
        }}>
          + New
        </button>
      </div>
      {templates.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', textAlign: 'center', padding: '16px 0' }}>
          No templates yet
        </p>
      ) : (
        <SwipeDeleteProvider>
          {templates.map(t => (
            <SwipeToDelete key={t.id} id={`template-${t.id}`} onDelete={() => handleDelete(t.id)} borderRadius="14px">
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', borderRadius: '14px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 500, color: 'var(--tg-theme-text-color)', marginBottom: '2px' }}>
                    {t.name}
                  </p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
                    {t.exercises.length} exercises
                  </p>
                </div>
              </div>
            </SwipeToDelete>
          ))}
        </SwipeDeleteProvider>
      )}
    </div>
  )
}
