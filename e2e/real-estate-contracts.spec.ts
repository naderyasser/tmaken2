import { test, expect, request } from '@playwright/test'

// Contract request intake (إدارة العقود). Public guest submit → lands in the Frappe desk by type.
// Each of the 4 types submits with the SHARED essentials only (type-specific fields optional). All
// writes carry the is_test marker (sentinel in notes) and are purged in afterAll.
// Run: STORE_URL=http://localhost:8080 TEST_PURGE_TOKEN=… npx playwright test e2e/real-estate-contracts.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const API = `${STORE}/api/method/base_meena.real_estate.aqar_public_api`
const MARK = 'tamkeen-e2e.test'

const shared = (contract_type: string) => ({
  contract_type,
  applicant_name: 'مقدّم طلب اختبار',
  applicant_phone: '0512345678',
  preferred_channel: 'WhatsApp',
  notes: `طلب تجريبي ${MARK}`,
})

test.afterAll(async () => {
  const ctx = await request.newContext()
  await ctx.post(`${API}.purge_test_contracts`, { form: { token: process.env.TEST_PURGE_TOKEN || '' } }).catch(() => {})
  await ctx.dispose()
})

// ---------- API: each type submits as a guest with shared essentials only ----------
for (const [type, label] of [
  ['Residential Rent', 'إيجار سكني'],
  ['Commercial Rent', 'إيجار تجاري'],
  ['Sale', 'بيع'],
  ['Brokerage', 'وساطة'],
] as const) {
  test(`guest submits a ${label} request → stored with correct type`, async ({ request }) => {
    const r = await (await request.post(`${API}.submit_contract_request`, { form: shared(type) })).json()
    expect(r.message?.ok).toBeTruthy()
    expect(r.message?.contract_type).toBe(type)
    expect(r.message?.status).toBe('New')
    expect(r.message?.is_test).toBeTruthy() // marker → flagged, no admin email, purgeable
  })
}

test('invalid phone is rejected', async ({ request }) => {
  const res = await request.post(`${API}.submit_contract_request`, {
    form: { ...shared('Sale'), applicant_phone: 'abc' },
  })
  expect(res.status()).not.toBe(200) // ValidationError
})

test('invalid contract type is rejected', async ({ request }) => {
  const res = await request.post(`${API}.submit_contract_request`, { form: shared('Nope') })
  expect(res.status()).not.toBe(200)
})

// ---------- Admin dashboard surfacing (gated on token auth) ----------
const KEY = process.env.TEST_REVIEW_KEY
const SECRET = process.env.TEST_REVIEW_SECRET
test('admin dashboard surfaces contract requests (count + recent list)', async () => {
  test.skip(!(KEY && SECRET), 'set TEST_REVIEW_KEY/TEST_REVIEW_SECRET (a System Manager) to run')
  const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `token ${KEY}:${SECRET}` } })
  try {
    const ADMIN = `${STORE}/api/method/base_meena.real_estate.aqar_api`
    const dash = (await (await ctx.get(`${ADMIN}.get_dashboard`)).json()).message
    expect(typeof dash.new_contracts).toBe('number') // KPI card source
    const extras = (await (await ctx.get(`${ADMIN}.get_dashboard_extras`)).json()).message
    expect(Array.isArray(extras.contracts)).toBeTruthy() // recent-requests strip source
  } finally {
    await ctx.dispose()
  }
})

// ---------- UI: type-conditional stepper ----------
test('contracts page: type selector → conditional fields per type', async ({ page }) => {
  await page.goto(`${STORE}/contracts`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('املأ اللي عندك، وفريقنا يكمّل الباقي معاك')).toBeVisible({ timeout: 8000 })
  // pick بيع → applicant step → details step
  await page.getByRole('button', { name: /بيع/ }).first().click()
  await page.locator('input').first().fill('اختبار')
  await page.getByPlaceholder('05XXXXXXXX').fill('0512345678')
  await page.getByRole('button', { name: 'واتساب' }).click()
  await page.getByRole('button', { name: 'التالي' }).click()
  // Sale-only field present, rent-only field absent
  await expect(page.getByText('رقم الصك')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('رقم عداد الكهرباء')).toHaveCount(0)
})
