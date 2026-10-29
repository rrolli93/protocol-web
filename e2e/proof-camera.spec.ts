import { expect, test } from '@playwright/test'

const DARE_ID = '33333333-3333-4333-8333-333333333333'

test('records proof with a fake camera and shows the code word', async ({ page }) => {
  const session = await page.request.post('/api/dev/session', { data: { persona: 'doer' } })
  expect(session.ok()).toBeTruthy()

  await page.goto(`/dare/${DARE_ID}/proof`)
  await expect(page.getByText('Signed in as doer')).toBeVisible()
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByText('SAY THIS IN THE FIRST 10 SECONDS')).toBeVisible()
  await expect(page.locator('video')).toBeVisible()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByRole('button', { name: 'Upload this clip' })).toBeVisible()
})

test('share image is a PNG and the landing page explains the product', async ({ page }) => {
  const image = await page.request.get(`/dare/${DARE_ID}/opengraph-image`)
  expect(image.ok()).toBeTruthy()
  expect(image.headers()['content-type']).toContain('image/png')
  const bytes = await image.body()
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Friends fund the challenge.' })).toBeVisible()
  await expect(page.getByText('I confirm I am 18 or older.')).toBeVisible()
  await page.goto(`/dare/${DARE_ID}/invite`)
  await expect(page.getByRole('heading', { name: '100 push-ups' })).toBeVisible()
  await expect(page.getByText('The doer stakes nothing.')).toBeVisible()
})
