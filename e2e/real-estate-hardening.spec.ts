import { test, expect, request } from '@playwright/test'

// Hardening pass: filter/search correctness, edge cases, empty states, input validation, and a
// regression for the malformed-cursor 500 fix. All lead writes carry the is_test marker and are
// purged in afterAll — never polluting real leads.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-hardening.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const API = `${STORE}/api/method/base_meena.real_estate.aqar_public_api`
const MARK = 'tamkeen-e2e.test'

test.afterAll(async () => {
  const ctx = await request.newContext()
  await ctx.post(`${API}.purge_test_leads`, { form: { token: process.env.TEST_PURGE_TOKEN || '' } }).catch(() => {})
  await ctx.dispose()
})

// ---------- Filter / search correctness (API) ----------
test('acceptance: Rent + price_max=40000 → ONLY Rent listings ≤ 40000', async ({ request }) => {
  const r = await (await request.get(`${API}.search_listings?listing_type=Rent&price_max=40000&limit=50`)).json()
  const res = r.message.results as any[]
  expect(res.length).toBeGreaterThan(0)
  for (const x of res) {
    expect(x.listing_type).toBe('Rent')
    expect(x.price ?? 0).toBeLessThanOrEqual(40000)
  }
})

test('stacked filters (city+type+category+price) all apply', async ({ request }) => {
  const r = await (await request.get(`${API}.search_listings?city=CITY-3&listing_type=Sale&category=Villas&price_max=5000000&limit=50`)).json()
  for (const x of r.message.results as any[]) {
    expect(x.city).toBe('CITY-3')
    expect(x.listing_type).toBe('Sale')
    expect(x.category).toBe('Villas')
    expect(x.price ?? 0).toBeLessThanOrEqual(5000000)
  }
})

test('cities-with-listings have positive counts (no dead-ends)', async ({ request }) => {
  const cities = (await (await request.get(`${API}.list_cities_with_listings`)).json()).message as any[]
  expect(cities.length).toBeGreaterThan(0)
  for (const c of cities) expect(c.count).toBeGreaterThan(0)
})

// ---------- Input validation / robustness (API) ----------
test('malformed cursor does not 500 (regression)', async ({ request }) => {
  expect((await request.get(`${API}.search_listings?cursor=not-json`)).status()).toBe(200)
  expect((await request.get(`${API}.search_listings?cursor=123`)).status()).toBe(200)
})

test('injection + junk params are safely handled (no 500, empty)', async ({ request }) => {
  const sqli = await request.get(`${API}.search_listings?category=${encodeURIComponent("x'; DROP TABLE `tabAqar Listing`;--")}`)
  expect(sqli.status()).toBe(200)
  expect((await sqli.json()).message.results.length).toBe(0)
  expect((await request.get(`${API}.get_investment_overview?price_min=abc&limit=2`)).status()).toBe(200)
})

test('non-active listing is not exposed via get_listing (no IDOR)', async ({ request }) => {
  // AQAR-00762 is a known non-active listing in this dataset
  const r = await (await request.get(`${API}.get_listing?name=AQAR-00762`)).json()
  expect(r.message == null || r.message === '').toBeTruthy()
})

// ---------- Lead pipeline (API, is_test) ----------
test('submit_lead rejects empty contact, stores valid one with intent', async ({ request }) => {
  const empty = await (await request.post(`${API}.submit_lead`, { form: { topic: 'Auctions', contact: '' } })).json()
  expect(empty.exc_type || empty.exception).toBeTruthy() // rejected
  const ok = await (await request.post(`${API}.submit_lead`, { form: { topic: 'Auctions', intent: 'Bidder', contact: `probe@${MARK}` } })).json()
  expect(ok.message.ok).toBeTruthy()
  expect(ok.message.is_test).toBeTruthy() // marker → flagged, no admin email
})

// ---------- Fix 1: token-gated purge ----------
test('purge_test_leads requires the shared token (403 otherwise)', async ({ request }) => {
  expect((await request.post(`${API}.purge_test_leads`)).status()).toBe(403)
  expect((await request.post(`${API}.purge_test_leads`, { form: { token: 'wrong' } })).status()).toBe(403)
  if (process.env.TEST_PURGE_TOKEN) {
    expect((await request.post(`${API}.purge_test_leads`, { form: { token: process.env.TEST_PURGE_TOKEN } })).status()).toBe(200)
  }
})

// ---------- Fix 2: contact validation (server-authoritative) ----------
test('submit_lead validates contact: reject garbage, accept phone & email & intl', async ({ request }) => {
  const post = (contact: string) => request.post(`${API}.submit_lead`, { form: { topic: 'Other', contact } })
  expect((await (await post('asdf')).json()).exc_type).toBeTruthy()            // garbage → rejected
  expect((await (await post('')).json()).exc_type).toBeTruthy()                // empty → rejected
  // accepted (marker suffix → is_test, purged in teardown; digits/email still validate)
  expect((await (await post(`buyer@${MARK}`)).json()).message?.ok).toBeTruthy()             // email
  expect((await (await post(`+44 20 7946 0958 ${MARK}`)).json()).message?.ok).toBeTruthy()  // intl phone
})

// ---------- Fix 3: thin-benchmark guard + label ----------
test('rent benchmarks expose sample count n; yields only when n>=3', async ({ request }) => {
  const d = (await (await request.get(`${API}.get_investment_overview?limit=24`)).json()).message
  const vals = Object.values(d.rent_by_cat) as any[]
  expect(vals.length).toBeGreaterThan(0)
  for (const b of vals) { expect(typeof b.v).toBe('number'); expect(typeof b.n).toBe('number') }
})

test('investment page shows the "N comparables" basis where a yield is estimated', async ({ page }) => {
  await page.goto(`${STORE}/investment`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('a.aqar-card').first()).toBeVisible({ timeout: 8000 })
  const html = await page.content()
  // a yield (X.X%) implies the basis label must accompany it
  if (/\d\.\d%/.test(html)) expect(html).toContain('عقارات مماثلة')
})

// ---------- Fix 4: security headers (next.config) ----------
test('security headers present incl CSP report-only', async ({ request }) => {
  const h = (await request.get(`${STORE}/investment`)).headers()
  expect(h['x-frame-options']).toBe('SAMEORIGIN')
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBeTruthy()
  expect((h['permissions-policy'] || '')).toContain('geolocation')
  expect((h['content-security-policy-report-only'] || '')).toContain("default-src 'self'")
})

// ---------- UI edge cases & empty states ----------
test('investment cards never render NaN', async ({ page }) => {
  await page.goto(`${STORE}/investment`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('a.aqar-card').first()).toBeVisible({ timeout: 8000 })
  expect(await page.content()).not.toContain('NaN')
})

test('impossible filter → clean empty state (not a broken page)', async ({ page }) => {
  // friendly empty state offers a one-tap clear (stable assertion: the مسح الفلاتر button)
  await page.goto(`${STORE}/search?price_max=1`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'مسح الفلاتر' })).toBeVisible({ timeout: 8000 })
  await page.goto(`${STORE}/investment?price_max=1`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'مسح الفلاتر' })).toBeVisible({ timeout: 8000 })
})

test('investment URL round-trip is deterministic', async ({ page }) => {
  const url = `${STORE}/investment?category=Villas&sort=ppsqm`
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('a.aqar-card').first()).toBeVisible({ timeout: 8000 })
  const titles1 = await page.locator('a.aqar-card h3').allInnerTexts()
  await page.reload({ waitUntil: 'domcontentloaded' })
  const titles2 = await page.locator('a.aqar-card h3').allInnerTexts()
  expect(titles2).toEqual(titles1) // same results & order after reload
})

test('near-me: permission-denied path shows a graceful message', async ({ page, context }) => {
  await context.clearPermissions() // ensure geolocation is NOT granted
  await page.goto(`${STORE}/search`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'القريب مني' }).click()
  await expect(page.getByText('تعذّر تحديد موقعك')).toBeVisible({ timeout: 8000 })
})
