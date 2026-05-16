import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Goal-to-Grid',
  description: 'Household execution engine from domains and goals to daily schedule',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
