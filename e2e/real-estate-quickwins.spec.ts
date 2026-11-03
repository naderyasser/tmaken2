import { test, expect, request as pwRequest } from '@playwright/test'

// Stage 2 quick wins: WhatsApp server-redirect CTA, mortgage calculator, offices directory.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-quickwins.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'

async function aSaleListing(): Promise<string | null> {
  const api = await pwRequest.newContext({ extraHTTPHeaders: { 'X-Marketplace': '1' } })
  // highest-priced sale listing so the mortgage math is non-trivial
  const res = await api.get(`${STORE}/api/method/base_meena.real_estate.aqar_public_api.search_listings?listing_type=Sale&sort=price_desc&limit=1`)
  const body = await res.json()
  await api.dispose()
  return body?.message?.results?.[0]?.name || null
}

test('WhatsApp button → server redirect resolves to wa.me (phone server-side)', async ({ page }) => {
  const listing = await aSaleListing()
  test.skip(!listing, 'no sale listing')
  await page.goto(`${STORE}/listing/${listing}`, { waitUntil: 'domcontentloaded' })
  const wa = page.locator('a[href*="wa_redirect"]').first()
  await expect(wa).toBeVisible()
  const href = await wa.getAttribute('href')
  expect(href).toContain('wa_redirect')
  // the endpoint 302-redirects to wa.me; phone is NOT in the page HTML
  const api = await pwRequest.newContext({ extraHTTPHeaders: { 'X-Marketplace': '1' } })
  const res = await api.get(new URL(href!, STORE).toString(), { maxRedirects: 0 })
  expect(res.status()).toBe(302)
  expect(res.headers()['location'] || '').toMatch(/^https:\/\/wa\.me\//)
  await api.dispose()
  // advertiser phone digits never in HTML (the fixed support-line wa.me link is fine)
  expect(await page.content()).not.toMatch(/wa\.me\/(?!966553275000)\d/)
})

test('mortgage calculator computes a monthly payment', async ({ page }) => {
  const listing = await aSaleListing()
  test.skip(!listing, 'no sale listing')
  await page.goto(`${STORE}/listing/${listing}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /احسب التمويل/ }).click()
  await expect(page.getByText('القسط الشهري التقديري')).toBeVisible()
  const sliders = page.locator('input.aqar-range')
  await expect(sliders.first()).toBeVisible()
  await page.waitForTimeout(700)
  const payEl = page.locator('p:has-text("ريال/شهر") .tabular-nums').first()
  const before = Number((await payEl.textContent())?.replace(/\D/g, '') || '0')
  expect(before).toBeGreaterThan(0)
  // changing the down-payment changes the payment
  await sliders.first().fill('40')
  await page.waitForTimeout(700)
  const after = Number((await payEl.textContent())?.replace(/\D/g, '') || '0')
  expect(after).not.toBe(before)
})

test('offices directory renders office cards', async ({ page }) => {
  const resp = await page.goto(`${STORE}/offices`, { waitUntil: 'networkidle' })
  expect(resp?.status()).toBe(200)
  await expect(page.locator('[data-office]').first()).toBeVisible()
  expect(await page.locator('[data-office]').count()).toBeGreaterThan(0)
})
