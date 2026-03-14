import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import './globals.css'
import BottomNav from '@/components/BottomNav'

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
      </head>
      <body>
        <TelegramProvider>
          <main className="pb-20 min-h-screen px-4 pt-4">
            {children}
          </main>
          <BottomNav />
        </TelegramProvider>
      </body>
    </html>
  )
}
