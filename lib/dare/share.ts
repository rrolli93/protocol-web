function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderShareCard(input: { title: string; result: string; amountLabel: string }): string {
  const title = escapeXml(input.title.slice(0, 80))
  const result = escapeXml(input.result.slice(0, 40))
  const amount = escapeXml(input.amountLabel.slice(0, 40))
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0A0A0F"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="#0D0D1A" stroke="#6C63FF"/>
  <text x="96" y="160" fill="#6C63FF" font-family="ui-monospace, monospace" font-size="28">DARE</text>
  <text x="96" y="280" fill="#ffffff" font-family="ui-monospace, monospace" font-size="54">${title}</text>
  <text x="96" y="380" fill="#00FF87" font-family="ui-monospace, monospace" font-size="36">${result}</text>
  <text x="96" y="470" fill="#8888AA" font-family="ui-monospace, monospace" font-size="28">${amount}</text>
</svg>`
}
