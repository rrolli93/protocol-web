import { renderShareCard } from '@/lib/dare/share'
import { getRepo } from '@/lib/dare/runtime'
import { formatChf } from '@/lib/dare/money'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('dare')
  let title = url.searchParams.get('title') ?? 'A dare'
  let result = url.searchParams.get('result') ?? 'Open'
  let amountLabel = url.searchParams.get('amount') ?? 'CHF'
  if (id) {
    const dare = await getRepo().getDare(id)
    if (dare) {
      title = dare.title
      result = dare.status === 'paid_out' ? 'Paid out' : dare.status === 'refunded' ? 'Refunded' : dare.status === 'failed' ? 'Missed' : 'In play'
      const bounty = await getRepo().sumCaptured(dare.id)
      amountLabel = bounty > 0 ? formatChf(bounty) : dare.mode === 'solo' ? 'Solo' : 'Unfunded'
    }
  }
  const svg = renderShareCard({ title, result, amountLabel })
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  })
}
