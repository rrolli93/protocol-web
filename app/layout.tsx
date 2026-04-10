import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PROTOCOL — Bet on Yourself',
  description: 'Stake real money on your fitness goals. Win when you succeed.',
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
        {children}
      </body>
    </html>
  )
}
