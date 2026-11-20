'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useTelegramBack } from '@/components/telegram'
import { ChevronLeftIcon } from '@/components/ui/icons'

/**
 * The one page header: a sentence-case title, an optional line under it, and
 * an optional control on the right. No eyebrow label above the title.
 *
 * `back` uses Telegram's native back button when the app runs inside Telegram
 * and falls back to an in-page link everywhere else.
 */
export default function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: { href: string; label: string }
  action?: ReactNode
}) {
  const router = useRouter()
  const tg = useTelegramBack()
  // Decided after mount: initData only exists client-side.
  const [nativeBack, setNativeBack] = useState(false)

  useEffect(() => {
    if (!back || !tg.available) return
    setNativeBack(true)
    return tg.attach(() => router.push(back.href))
  }, [back?.href, tg, router]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header style={{ marginBottom: 20 }}>
      {back && !nativeBack && (
        <Link
          href={back.href}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            minHeight: 44, marginLeft: -8, padding: '0 8px',
            color: 'var(--muted)', fontSize: 15, fontWeight: 500, textDecoration: 'none',
          }}
        >
          <ChevronLeftIcon size={20} />
          {back.label}
        </Link>
      )}
      {/* The action shares the title's row only; the subtitle runs full width
          below so it never wraps around the action. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, minWidth: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--ink)' }}>
          {title}
        </h1>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {subtitle && (
        <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--muted)' }}>{subtitle}</p>
      )}
    </header>
  )
}
