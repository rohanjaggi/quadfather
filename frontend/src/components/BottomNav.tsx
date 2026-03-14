'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/',         label: 'Home',     icon: '🏠' },
  { href: '/food',     label: 'Food',     icon: '🍽️' },
  { href: '/water',    label: 'Water',    icon: '💧' },
  { href: '/workouts', label: 'Workouts', icon: '💪' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex border-t"
      style={{
        backgroundColor: 'var(--tg-theme-bg-color)',
        borderColor: 'var(--tg-theme-hint-color)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 flex-col items-center py-2 gap-0.5 text-xs"
            style={{ color: isActive ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-hint-color)' }}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
