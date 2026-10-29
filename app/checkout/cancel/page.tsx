import Link from 'next/link'

export default function CancelPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#ffffff' }}>Checkout cancelled</h1>
        <p className="text-sm mb-6" style={{ color: '#8888AA' }}>No money moved.</p>
        <Link href="/dashboard" style={{ color: '#6C63FF' }}>Back</Link>
      </div>
    </main>
  )
}
