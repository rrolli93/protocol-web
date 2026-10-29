import Link from 'next/link'

export const metadata = { title: 'Terms (draft) · Dare' }

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#0A0A0F', color: '#cccccc' }}>
      <article className="max-w-2xl mx-auto">
        <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ color: '#FF8C42', backgroundColor: 'rgba(255,140,66,0.12)' }}>
          Draft, pending Swiss legal review. The Gespa question is unresolved. Do not treat this as final legal advice. Paid mode stays off until that review.
        </p>
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#ffffff' }}>Terms of use</h1>
        <p className="mb-3">Dare is for adults, 18 or older. A dare is a friend-funded bounty for a physical or skill challenge. The person who does the dare does not pay an entry fee, a stake, or a deposit.</p>
        <p className="mb-3">There is no shared pot and no bet against the doer. A funder’s best outcome is the challenge they paid for, or their own money back, unless they chose to send a miss to charity.</p>
        <p className="mb-3">Dangerous, illegal, or sexual dares are not allowed. That includes stunts, substances, anything involving minors, and sexual content. Dare may cancel a dare and refund or mark funds for charity.</p>
        <p className="mb-3">You are responsible for your own safety. Video you upload is personal data. See the privacy draft for retention.</p>
        <p className="mb-6">The platform fee is shown before payment. It may be taken from the bounty or added on top. Card-network fees are not returned by Stripe when a charge is refunded.</p>
        <Link href="/" style={{ color: '#6C63FF' }}>Back</Link>
      </article>
    </main>
  )
}
