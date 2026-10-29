import Link from 'next/link'

export const metadata = { title: 'Privacy (draft) · Dare' }

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#0A0A0F', color: '#cccccc' }}>
      <article className="max-w-2xl mx-auto">
        <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ color: '#FF8C42', backgroundColor: 'rgba(255,140,66,0.12)' }}>
          Draft, pending Swiss legal review (revDSG / GDPR). Not a final privacy notice.
        </p>
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#ffffff' }}>Privacy</h1>
        <p className="mb-3">We store your account, date of birth (to check that you are 18+), dares you create or fund, and videos you submit as proof. Videos are private. Reviewers and the people on that dare can open a short-lived link.</p>
        <p className="mb-3">Proof videos are deleted after 90 days. You can ask for deletion of your account data. Waitlist emails are used only to contact you about early access.</p>
        <p className="mb-3">If an AI proof check is configured, the rules, the code word, and a short clip may be sent to that provider. The default checker sends nothing. See the deploy notes for the Gemini option and its age limits.</p>
        <p className="mb-6">Payments are processed by Stripe. Dare does not store card numbers.</p>
        <Link href="/" style={{ color: '#6C63FF' }}>Back</Link>
      </article>
    </main>
  )
}
