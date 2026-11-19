'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import Sheet from '@/components/ui/Sheet'
import { useHaptic } from '@/components/telegram'
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, EditIcon, RefreshIcon } from '@/components/ui/icons'
import ManualRunForm from './ManualRunForm'
import RunPhotoUpload from './RunPhotoUpload'
import type { StravaState } from './StravaSync'
import { ACCEPT_IMAGE_ATTR } from '@/lib/image'

type Step = 'choose' | 'photo' | 'manual'

const TITLES: Record<Step, string> = {
  choose: 'Log a run',
  photo: 'From a screenshot',
  manual: 'Enter manually',
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 60,
  padding: '8px 16px', border: 'none', background: 'transparent', textAlign: 'left',
  fontSize: 16, fontWeight: 500, color: 'var(--ink)', textDecoration: 'none',
}

function RowBody({ Icon, label, hint }: { Icon: ComponentType<{ size?: number }>; label: string; hint: ReactNode }) {
  return (
    <>
      <span style={{ color: 'var(--muted)', display: 'grid' }}><Icon size={22} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {label}
        <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>{hint}</span>
      </span>
      <span style={{ color: 'var(--muted)', display: 'grid' }}><ChevronRightIcon size={18} /></span>
    </>
  )
}

/**
 * The run chooser: screenshot, manual entry, or Strava, as list rows. The
 * screenshot row opens the picker straight away (the click has to stay inside
 * the tap for iOS to allow it), then the sheet shows the reading step.
 */
export default function LogRunSheet({
  open,
  onClose,
  onLogged,
  onStravaSync,
  strava,
}: {
  open: boolean
  /** Must be stable (Sheet re-runs its focus effect when it changes). */
  onClose: () => void
  onLogged: () => void
  onStravaSync: () => void
  strava: StravaState
}) {
  const haptic = useHaptic()
  const [step, setStep] = useState<Step>('choose')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setStep('choose'); setFile(null) }
  }, [open])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    setFile(picked)
    setStep('photo')
  }

  const stravaRow = strava.connected && !strava.needsReconnect ? (
    <button
      type="button"
      disabled={strava.syncing}
      onClick={() => { haptic.selection(); onStravaSync() }}
      style={{ ...rowStyle, borderTop: '1px solid var(--line)', opacity: strava.syncing ? 0.6 : 1 }}
    >
      <RowBody
        Icon={RefreshIcon}
        label="Sync from Strava"
        hint={strava.syncing ? 'Syncing…' : strava.lastSynced ? `Connected · synced ${strava.lastSynced}` : 'Connected'}
      />
    </button>
  ) : (
    <Link href="/profile/strava" onClick={onClose} style={{ ...rowStyle, borderTop: '1px solid var(--line)' }}>
      <RowBody
        Icon={RefreshIcon}
        label="Sync from Strava"
        hint={strava.needsReconnect ? 'Reconnect Strava in Settings' : 'Connect Strava in Settings'}
      />
    </Link>
  )

  return (
    <Sheet open={open} onClose={onClose} title={TITLES[step]}>
      <input ref={fileRef} type="file" accept={ACCEPT_IMAGE_ATTR} onChange={pickFile} style={{ display: 'none' }} />

      {step === 'choose' ? (
        <div className="card" style={{ padding: 0 }}>
          <button type="button" onClick={() => { haptic.selection(); fileRef.current?.click() }} style={rowStyle}>
            <RowBody Icon={CameraIcon} label="From a screenshot" hint="A run summary from your watch or app" />
          </button>
          <button
            type="button"
            onClick={() => { haptic.selection(); setStep('manual') }}
            style={{ ...rowStyle, borderTop: '1px solid var(--line)' }}
          >
            <RowBody Icon={EditIcon} label="Enter manually" hint="Distance and time" />
          </button>
          {stravaRow}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setStep('choose')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, margin: '-8px 0 8px -14px' }}
          >
            <ChevronLeftIcon size={18} /> Other ways to log
          </button>
          {step === 'photo' && <RunPhotoUpload file={file} onLogged={onLogged} />}
          {step === 'manual' && <ManualRunForm onLogged={onLogged} />}
        </>
      )}
    </Sheet>
  )
}
