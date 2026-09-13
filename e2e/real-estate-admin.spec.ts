import { test, expect, request as pwRequest } from '@playwright/test'

// Phase 5 storefront-observable checks (guest, no admin login):
//  - SEO 404: unknown cities/listings/paths return a real 404 with the branded page,
//    while real cities return 200 (fixes the [city] soft-404).
//  - The category pipeline + listings render in the browser.
// The admin ACTIONS (category create→storefront, ban→vanish→unban, package edit, role
// grant/revoke) are covered end-to-end — action + live storefront effect + auth + audit —
// by the backend suite base_meena.real_estate.admin_test.run_all (14/14), since driving
// the manager-only settings UI in-browser needs the full ERP auth bootstrap.
//
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-admin.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'

async function aRealCity(): Promise<string | null> {
  const api = await pwRequest.newContext({ extraHTTPHeaders: { 'X-Marketplace': '1' } })
  const res = await api.get(`${STORE}/api/method/base_meena.real_estate.aqar_public_api.search_listings?limit=1`)
  const body = await res.json()
  await api.dispose()
  return body?.message?.results?.[0]?.city || null
}

test('unknown city path → real 404 with branded Arabic page (no soft-404)', async ({ page }) => {
  const resp = await page.goto(`${STORE}/this-city-does-not-exist-xyz`, { waitUntil: 'domcontentloaded' })
  expect(resp?.status()).toBe(404)
  await expect(page.getByText('الصفحة غير موجودة')).toBeVisible()
  await expect(page.getByText('٤٠٤')).toBeVisible()           // branded Arabic 404 numeral
  await expect(page.getByRole('link', { name: 'الرئيسية' }).first()).toBeVisible()
})

test('unknown listing → 404', async ({ page }) => {
  const resp = await page.goto(`${STORE}/listing/AQAR-DOES-NOT-EXIST-999`, { waitUntil: 'domcontentloaded' })
  expect(resp?.status()).toBe(404)
})

test('unknown city/district → 404', async ({ page }) => {
  const resp = await page.goto(`${STORE}/nope-city/nope-district`, { waitUntil: 'domcontentloaded' })
  expect(resp?.status()).toBe(404)
})

test('a real city path still returns 200', async ({ page }) => {
  const city = await aRealCity()
  test.skip(!city, 'no active listing with a city to test')
  const resp = await page.goto(`${STORE}/${encodeURIComponent(city!)}`, { waitUntil: 'domcontentloaded' })
  expect(resp?.status()).toBe(200)
  await expect(page.locator('.aqar-store')).toBeVisible()
})

test('storefront renders categories + listings (taxonomy pipeline)', async ({ page }) => {
  // the category <select> sits behind «فلاتر أكثر» (progressive disclosure) — open it,
  // then the taxonomy pipeline must have populated real options beyond the placeholder
  await page.goto(`${STORE}/search`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /فلاتر أكثر/ }).click()
  const options = page.getByLabel('القسم').locator('option')
  await expect.poll(async () => options.count()).toBeGreaterThan(1) // placeholder + real categories
  await expect(page.locator('[data-id]').first()).toBeVisible()     // listing cards (map-search list)
})
