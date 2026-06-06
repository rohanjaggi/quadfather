import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import { UserProvider } from '@/context/UserContext'

const TelegramProvider = dynamic(() => import('@/components/TelegramProvider'), { ssr: false })

export const metadata: Metadata = {
  title: 'Quadfather',
  description: 'Track your calories, protein, water, and workouts',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
            <main style={{ paddingBottom: '80px', minHeight: '100svh', padding: '24px 18px 96px' }}>
              {children}
            </main>
            <BottomNav />
          </UserProvider>
        </TelegramProvider>
        <Analytics />
      </body>
    </html>
  )
}
