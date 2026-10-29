import { formatChf } from './money'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function shareText(input: { title: string; bountyCents: number; status: string }): { title: string; description: string } {
  const amount = input.bountyCents > 0 ? formatChf(input.bountyCents) : 'an open bounty'
  const result = input.status === 'paid_out'
    ? 'Done — the doer was paid.'
    : input.status === 'refunded'
      ? 'Missed — the funder was refunded.'
      : input.status === 'failed'
        ? 'Missed.'
        : 'In play.'
  return {
    title: `${input.title} · Dare`,
    description: `${result} A friend funds this dare. The doer never pays. Bounty ${amount}. Done pays the doer. Missed refunds the funder, or goes to charity if they chose that.`,
  }
}

export function renderShareCard(input: { title: string; result: string; amountLabel: string }): string {
  const title = escapeXml(input.title.slice(0, 80))
  const result = escapeXml(input.result.slice(0, 80))
  const amount = escapeXml(input.amountLabel.slice(0, 40))
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1233"/>
      <stop offset="1" stop-color="#07060d"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="10%" r="55%">
      <stop offset="0" stop-color="#6C63FF" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#6C63FF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="40" r="320" fill="url(#glow)"/>
  <text x="88" y="150" fill="#c9c2ff" font-family="ui-monospace, monospace" font-size="26" letter-spacing="6">DARE</text>
  <text x="88" y="270" fill="#ffffff" font-family="ui-sans-serif, sans-serif" font-size="58">${title}</text>
  <text x="88" y="360" fill="#7dffe0" font-family="ui-sans-serif, sans-serif" font-size="36">${result}</text>
  <text x="88" y="450" fill="#c4bdd6" font-family="ui-sans-serif, sans-serif" font-size="28">${amount}</text>
  <text x="88" y="520" fill="#c4bdd6" font-family="ui-sans-serif, sans-serif" font-size="24">The doer never pays.</text>
</svg>`
}
