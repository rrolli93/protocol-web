import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { formatChf } from '@/lib/dare/money'
import { getRepo } from '@/lib/dare/runtime'
import { shareText } from '@/lib/dare/share'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const repo = getRepo()
    const dare = await repo.getDare(id)
    if (!dare) return { title: 'Dare' }
    const bounty = await repo.sumCaptured(dare.id)
    const copy = shareText({ title: dare.title, bountyCents: bounty, status: dare.status })
    return {
      title: copy.title,
      description: copy.description,
      openGraph: {
        title: copy.title,
        description: copy.description,
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: copy.title,
        description: copy.description,
      },
      other: {
        'og:image:alt': `${dare.title}. ${bounty ? formatChf(bounty) : 'Open bounty'}. The doer never pays.`,
      },
    }
  } catch {
    return { title: 'Dare' }
  }
}

export default function DareLayout({ children }: { children: ReactNode }) {
  return children
}
