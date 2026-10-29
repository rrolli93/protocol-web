import type { Metadata } from 'next'
import DevSwitcher from './components/DevSwitcher'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dare — friends fund the challenge',
  description: 'A friend funds a physical challenge. The doer stakes nothing. Done pays the bounty minus a fee. Missed refunds the funder.',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ backgroundColor: '#0A0A0F', color: '#ffffff', fontFamily: "'Inter', sans-serif" }}>
        <DevSwitcher />
        {children}
      </body>
    </html>
  )
}
