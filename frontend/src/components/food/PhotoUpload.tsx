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
    <div className="flex flex-col gap-3">
      {/* Upload area */}
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-8 gap-2"
        style={{ borderColor: 'var(--tg-theme-hint-color)' }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Meal preview" className="w-full rounded-xl object-cover max-h-48" />
        ) : (
          <>
            <span className="text-4xl">📸</span>
            <span className="text-sm" style={{ color: 'var(--tg-theme-hint-color)' }}>
              Tap to take a photo or upload
            </span>
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
        placeholder="Optional: describe the meal, portion size, ingredients…"
        rows={3}
        className="w-full rounded-xl p-3 text-sm resize-none outline-none"
        style={{
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          color: 'var(--tg-theme-text-color)',
        }}
      />

      <button
        className="w-full rounded-xl py-3 text-sm font-semibold"
        style={{
          backgroundColor: 'var(--tg-theme-button-color)',
          color: 'var(--tg-theme-button-text-color)',
          opacity: preview ? 1 : 0.5,
        }}
        disabled={!preview}
      >
        Analyse Macros
      </button>
    </div>
  )
}
