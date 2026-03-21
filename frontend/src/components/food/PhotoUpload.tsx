'use client'

import { useRef, useState } from 'react'

export default function PhotoUpload() {
  const [preview, setPreview] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setPreview(URL.createObjectURL(file))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Upload zone */}
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          borderRadius: '18px',
          border: '1.5px dashed var(--surface-border)',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: preview ? 0 : '36px 24px',
          overflow: 'hidden',
          minHeight: preview ? '180px' : undefined,
          cursor: 'pointer',
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Meal preview"
            style={{ width: '100%', objectFit: 'cover', maxHeight: '220px', display: 'block' }}
          />
        ) : (
          <>
            <div style={{
              width: 44, height: 44,
              borderRadius: '50%',
              backgroundColor: 'var(--tg-theme-bg-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="var(--tg-theme-hint-color)" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 500,
              color: 'var(--tg-theme-text-color)',
              marginBottom: '4px',
            }}>
              Photograph your meal
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
            }}>
              or upload from your gallery
            </p>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your meal, portions, ingredients…"
        rows={3}
        style={{
          width: '100%',
          borderRadius: '14px',
          padding: '14px 16px',
          fontSize: '14px',
          fontFamily: 'var(--font-body)',
          resize: 'none',
          outline: 'none',
          border: 'none',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          color: 'var(--tg-theme-text-color)',
        }}
      />

      {/* Submit */}
      <button
        disabled={!preview}
        style={{
          width: '100%',
          borderRadius: '14px',
          padding: '15px',
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          border: 'none',
          backgroundColor: 'var(--tg-theme-button-color)',
          color: 'var(--tg-theme-button-text-color)',
          opacity: preview ? 1 : 0.3,
          cursor: preview ? 'pointer' : 'not-allowed',
        }}
      >
        Analyse Macros
      </button>
    </div>
  )
}
