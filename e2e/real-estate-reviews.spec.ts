import { test, expect, request, type APIRequestContext } from '@playwright/test'

// Verified office/agent reviews. Reviews attach to the OFFICE (Aqar Advertiser), land Pending,
// and are public only once approved. Guests can READ approved reviews but cannot WRITE.
//
// Always-on (no creds needed): guest write is blocked; the public read endpoint never leaks
// pending/rejected. The full authed lifecycle (submit→pending→not-public→approve→public,
// one-per-user, report) is GATED on token auth (TEST_REVIEW_KEY:TEST_REVIEW_SECRET) and skips
// gracefully when absent — exactly like the purge_test_leads test gates on TEST_PURGE_TOKEN.
// All authed writes carry is_test=1 and are purged in afterAll.
// Run: STORE_URL=http://localhost:8080 TEST_PURGE_TOKEN=… npx playwright test e2e/real-estate-reviews.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const PUBLIC = `${STORE}/api/method/base_meena.real_estate.aqar_public_api`
const SOCIAL = `${STORE}/api/method/base_meena.real_estate.aqar_social_api`

const KEY = process.env.TEST_REVIEW_KEY
const SECRET = process.env.TEST_REVIEW_SECRET
const authed = !!(KEY && SECRET)
const authHeaders = authed ? { Authorization: `token ${KEY}:${SECRET}` } : {}

let officeId = ''

test.beforeAll(async () => {
  const ctx = await request.newContext()
  const offices = (await (await ctx.get(`${PUBLIC}.list_offices?limit=1`)).json()).message
  officeId = offices?.[0]?.name || ''
  await ctx.dispose()
})

test.afterAll(async () => {
  const ctx = await request.newContext()
  await ctx.post(`${PUBLIC}.purge_test_reviews`, { form: { token: process.env.TEST_PURGE_TOKEN || '' } }).catch(() => {})
  await ctx.dispose()
})

// ---------- Always-on ----------
test('guest cannot write a review (auth required)', async ({ request }) => {
  expect(officeId).toBeTruthy()
  const res = await request.post(`${SOCIAL}.submit_review`, { form: { office: officeId, rating: 5, body: 'guest' } })
  expect(res.status()).toBe(403) // @frappe.whitelist() without allow_guest blocks Guest
})

test('public reviews endpoint returns the aggregate shape and approved-only', async ({ request }) => {
  const d = (await (await request.get(`${PUBLIC}.get_office_reviews?office=${officeId}`)).json()).message
  expect(d).toHaveProperty('reviews')
  expect(d).toHaveProperty('rating_avg')
  expect(d).toHaveProperty('review_count')
  expect(Array.isArray(d.reviews)).toBeTruthy()
  // review_count must equal the number of publicly returned (approved) rows on a first page
  if (!d.has_more) expect(d.review_count).toBe(d.reviews.length)
})

test('office cards/listings expose rating_avg + review_count fields', async ({ request }) => {
  const office = (await (await request.get(`${PUBLIC}.list_offices?limit=1`)).json()).message[0]
  expect(office).toHaveProperty('rating_avg')
  expect(office).toHaveProperty('review_count')
})

// ---------- UI: write form gated behind ENABLE_BUYER_LOGIN (default off) ----------
test('advertiser page shows read-only reviews but NOT the write form when buyer-login is off', async ({ page }) => {
  await page.goto(`${STORE}/advertiser/${officeId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'تقييمات العملاء' })).toBeVisible({ timeout: 8000 })
  // flag off → no "أضف تقييمك" write form, and therefore no login prompt for a login that doesn't exist
  await expect(page.getByText('أضف تقييمك')).toHaveCount(0)
})

// ---------- Authed lifecycle (gated on token auth) ----------
test('lifecycle: write→pending→not-public→approve→public; one-per-user; report', async () => {
  test.skip(!authed, 'set TEST_REVIEW_KEY/TEST_REVIEW_SECRET (a System Manager) to run the authed lifecycle')
  const ctx: APIRequestContext = await request.newContext({ extraHTTPHeaders: authHeaders })
  try {
    // write (is_test=1 honored for System Manager) → Pending
    const sub = (await (await ctx.post(`${SOCIAL}.submit_review`, { form: { office: officeId, rating: 5, body: 'تجربة ممتازة', is_test: 1 } })).json()).message
    expect(sub.status).toBe('Pending')
    const name = sub.name

    // pending → NOT public
    let pub = (await (await ctx.get(`${PUBLIC}.get_office_reviews?office=${officeId}`)).json()).message
    expect(pub.reviews.find((r: any) => r.name === name)).toBeFalsy()

    // approve → public
    await ctx.post(`${SOCIAL}.moderate_review`, { form: { review: name, status: 'Approved' } })
    pub = (await (await ctx.get(`${PUBLIC}.get_office_reviews?office=${officeId}`)).json()).message
    expect(pub.reviews.find((r: any) => r.name === name)).toBeTruthy()
    expect(pub.review_count).toBeGreaterThan(0)
    expect(pub.rating_avg).toBeGreaterThan(0)

    // one-per-user: second submit updates in place (same name), back to Pending
    const sub2 = (await (await ctx.post(`${SOCIAL}.submit_review`, { form: { office: officeId, rating: 3, body: 'تحديث', is_test: 1 } })).json()).message
    expect(sub2.name).toBe(name)
    expect(sub2.status).toBe('Pending')

    // report bumps the counter
    const rep = (await (await ctx.post(`${SOCIAL}.report_review`, { form: { review: name } })).json()).message
    expect(rep.ok).toBeTruthy()
    expect(rep.report_count).toBeGreaterThanOrEqual(1)
  } finally {
    await ctx.dispose()
  }
})
