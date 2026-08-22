import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import AuthGate from '@/components/AuthGate'
import { UserProvider } from '@/context/UserContext'

const TelegramProvider = dynamic(() => import('@/components/TelegramProvider'), { ssr: false })

export const metadata: Metadata = {
  title: 'Quadfather',
  description: 'Track your calories, protein, water, and workouts',
}

// Must be exported (not a manual <meta> tag) — Next injects its own default
// viewport tag that would otherwise win and drop viewport-fit=cover, which
// zeroes env(safe-area-inset-bottom) in BottomNav.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TelegramProvider>
          <UserProvider>
            <AuthGate>
              {/* Bottom pad clears BottomNav, which itself pads by the safe-area
                  inset — without adding it here the last element of a page sits
                  under the nav on notched devices (viewport-fit=cover is on). */}
              <main style={{ minHeight: '100svh', padding: '24px 18px calc(96px + env(safe-area-inset-bottom))' }}>
                {children}
              </main>
              <BottomNav />
            </AuthGate>
          </UserProvider>
        </TelegramProvider>
        <Analytics />
      </body>
    </html>
  )
}
