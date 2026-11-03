import { test, expect } from '@playwright/test'

// Primary nav (6 items + active state + mobile hamburger), the real-time stacking filter bar
// (city combobox, price, near-me), and the new section pages (investment/auctions/property-mgmt).
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-nav-filters.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'

test('primary nav renders the seven items', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'networkidle' })
  const nav = page.locator('.aqar-nav-link')
  await expect(nav).toHaveCount(7)
  for (const label of ['الرئيسية', 'بيع', 'إيجارات', 'استثمار', 'إدارة عقارات', 'إدارة العقود', 'حراج عقارات']) {
    await expect(page.locator('.aqar-nav-link', { hasText: label }).first()).toBeVisible()
  }
})

test('active state reflects the purpose query (بيع on listing_type=Sale)', async ({ page }) => {
  // domcontentloaded (not networkidle): the active class is in the SSR HTML, and /search's live
  // map keeps the network busy so networkidle is unreliable. Assert by href (encoding-proof).
  await page.goto(`${STORE}/search?listing_type=Sale`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.aqar-nav-link.active[href="/search?listing_type=Sale"]')).toBeVisible()
  await page.goto(`${STORE}/search?listing_type=Rent`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.aqar-nav-link.active[href="/search?listing_type=Rent"]')).toBeVisible()
})

test('mobile hamburger opens the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(`${STORE}/`, { waitUntil: 'networkidle' })
  await expect(page.locator('.aqar-nav-mobile')).toHaveCount(0)
  await page.locator('.aqar-nav-burger').click()
  await expect(page.locator('.aqar-nav-mobile')).toBeVisible()
  await expect(page.locator('.aqar-nav-mobile-link')).toHaveCount(7)
})

test('city combobox lists only cities-with-listings and re-queries on pick', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.getByPlaceholder('المدينة', { exact: true }).click() // exact: keyword box also mentions المدينة
  // the cities-with-listings dropdown renders at least one option
  const opt = page.locator('[role="combobox"] ~ div button', { hasText: /\d/ }).first()
  await expect(opt).toBeVisible({ timeout: 6000 })
  const req = page.waitForRequest(/aqar_public_api\.search_listings/, { timeout: 8000 })
  await opt.click()
  await req // picking a city re-queries the filtered set
})

test('price filter narrows the query (stacking, debounced)', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  // frappeClient.call posts params in the body, so assert the method re-fires (proves the
  // price edit triggered a stacking re-query) and that the body carries price_max when present.
  // (price is now an always-visible quick filter — no toggle needed)
  const req = page.waitForRequest((r) => /search_listings/.test(r.url()), { timeout: 8000 })
  await page.getByPlaceholder('أعلى سعر').fill('500000')
  const fired = await req
  expect((fired.postData() || '') + fired.url()).toContain('price_max')
})

test('near-me uses geolocation then bounds-searches', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 24.7136, longitude: 46.6753 }) // Riyadh
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const req = page.waitForRequest(/aqar_public_api\.search_in_bounds/, { timeout: 10000 })
  await page.getByRole('button', { name: 'القريب مني' }).click()
  await req
})

test('section pages render on-brand', async ({ page }) => {
  await page.goto(`${STORE}/property-management`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'إدارة الأملاك العقارية' })).toBeVisible()
  await expect(page.getByText('اطلب الخدمة')).toBeVisible()
  // investment + auctions are covered in their own specs (real-estate-investment / -auctions)
})
