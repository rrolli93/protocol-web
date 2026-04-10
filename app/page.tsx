import Link from 'next/link'

export default function LandingPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      {/* Radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-lg w-full text-center">
        {/* Logo */}
        <div>
          <h1
            className="text-5xl md:text-7xl font-black tracking-[0.25em] select-none"
            style={{
              color: '#6C63FF',
              fontFamily: "'JetBrains Mono', monospace",
              textShadow: '0 0 40px rgba(108,99,255,0.5)',
            }}
          >
            ⬡ PROTOCOL
          </h1>
          <p
            className="mt-4 text-lg md:text-2xl font-light tracking-widest"
            style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Bet on yourself.
          </p>
          <p className="mt-3 text-sm md:text-base" style={{ color: '#8888AA' }}>
            Stake real money on your fitness goals. Win when you succeed.
            Lose when you don't. No excuses.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link
            href="/signup"
            className="flex-1 py-3 rounded-xl text-center font-semibold text-base transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: '#6C63FF',
              color: '#ffffff',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="flex-1 py-3 rounded-xl text-center font-semibold text-base border transition-all hover:border-purple-500 hover:text-white active:scale-95"
            style={{
              backgroundColor: 'transparent',
              color: '#8888AA',
              borderColor: '#1A1A2E',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Sign In
          </Link>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { emoji: '🏃', label: 'Run' },
            { emoji: '⚡', label: 'Fast' },
            { emoji: '😴', label: 'Sleep' },
            { emoji: '🧘', label: 'Meditate' },
          ].map(p => (
            <span
              key={p.label}
              className="px-4 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: 'rgba(108,99,255,0.1)',
                color: '#6C63FF',
                border: '1px solid rgba(108,99,255,0.2)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {p.emoji} {p.label}
            </span>
          ))}
        </div>

        {/* Bottom copy */}
        <p className="text-xs" style={{ color: '#8888AA' }}>
          Join thousands of challengers. Powered by USDC.
        </p>
      </div>
    </main>
  )
}
