import Link from 'next/link'

export const metadata = { title: 'How payouts work (draft) · Dare' }

export default function PayoutsPage() {
  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#0A0A0F', color: '#cccccc' }}>
      <article className="max-w-2xl mx-auto">
        <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ color: '#FF8C42', backgroundColor: 'rgba(255,140,66,0.12)' }}>
          Draft, pending Swiss legal review. The Gespa question is unresolved. Paid mode is off by default and live Stripe keys are refused.
        </p>
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#ffffff' }}>How payouts work</h1>
        <p className="mb-3">The doer never puts money in. A funder pays a bounty between the configured minimum (CHF 20 unless changed) and CHF 100. Several funders can add to the same dare, up to that cap.</p>
        <p className="mb-3">Two fee models exist, chosen in configuration. The funder sees the breakdown before paying.</p>
        <ul className="list-disc pl-5 mb-3">
          <li className="mb-2">Percent: a percentage (default 10%) is taken from the bounty. The doer receives the rest. A flat 10% does not cover Swiss Stripe fees below roughly CHF 42, and Stripe does not return its fee when you refund.</li>
          <li>Surcharge: the funder pays a service fee on top (default CHF 2 + 5%). The doer receives the full bounty. If the dare is missed, the bounty is refunded and the service fee is not, because card fees are not returned.</li>
        </ul>
        <p className="mb-3">Done: after proof is accepted and any dispute window has passed, Dare transfers the doer’s amount to their Stripe Connect account. The doer completes Express onboarding the first time they are paid.</p>
        <p className="mb-3">Missed: the funder is refunded, unless they chose “if this fails, the bounty goes to charity”. Charity payment itself is not sent automatically yet. The funding is marked for that charity.</p>
        <p className="mb-6">Solo pledges are different. Success returns the person’s own money. A miss is marked for charity. Nothing is paid to the user.</p>
        <Link href="/" style={{ color: '#6C63FF' }}>Back</Link>
      </article>
    </main>
  )
}
