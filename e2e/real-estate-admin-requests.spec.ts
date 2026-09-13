import { test, expect, request } from '@playwright/test'

// In-dashboard contract/lead inboxes. Verifies the team NEVER leaves the custom dashboard:
// the contract detail renders in-app (Arabic/RTL/espresso, not the Frappe desk) and an admin can
// update status from there. Gated on DASH_USER/DASH_PWD (a System Manager); skips without them.
//
// The dashboard lives on a NON-marketplace host (qarawi.base.meena.sa) that also proxies /api;
// the storefront :8080 host rewrites /real-estate away, so we use DASH_URL here.
// Run: DASH_URL=https://qarawi.base.meena.sa DASH_USER=… DASH_PWD=… TEST_PURGE_TOKEN=… \
//      npx playwright test e2e/real-estate-admin-requests.spec.ts --project=chromium

const DASH = process.env.DASH_URL || 'https://qarawi.base.meena.sa'
const API = `${DASH}/api/method/base_meena.real_estate.aqar_public_api`
const USER = process.env.DASH_USER
const PWD = process.env.DASH_PWD
const MARK = 'tamkeen-e2e.test'

let createdName = ''

test.afterAll(async () => {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true })
  await ctx.post(`${API}.purge_test_contracts`, { form: { token: process.env.TEST_PURGE_TOKEN || '' } }).catch(() => {})
  await ctx.dispose()
})

test('admin opens a contract request IN the dashboard and updates its status', async ({ page, context }) => {
  test.skip(!(USER && PWD), 'set DASH_USER/DASH_PWD (a System Manager) to run the in-dashboard UI test')

  // 1) seed an is_test contract via the public submit (marker in notes → purgeable)
  const seed = await (await context.request.post(`${API}.submit_contract_request`, {
    form: {
      contract_type: 'Sale', applicant_name: 'اختبار اللوحة', applicant_phone: '0512345678',
      preferred_channel: 'WhatsApp', notes: `طلب لوحة ${MARK}`,
      details: JSON.stringify({ 'العقار — رقم الصك': '999/888' }),
    },
  })).json()
  createdName = seed.message?.name
  expect(createdName).toBeTruthy()

  // 2) authenticate the browser context (cookie session)
  const login = await context.request.post(`${DASH}/api/method/login`, { form: { usr: USER!, pwd: PWD! } })
  expect(login.ok()).toBeTruthy()

  // 3) open the in-dashboard detail (NOT /app/...)
  await page.goto(`${DASH}/real-estate/contracts/${createdName}`, { waitUntil: 'domcontentloaded' })
  // the applicant name is Arabic data → proves our detail rendered in-app regardless of UI language
  await expect(page.getByText('اختبار اللوحة')).toBeVisible({ timeout: 15000 })

  // force the intended Arabic/RTL mode if the session defaulted to English
  const arBtn = page.getByRole('button', { name: 'العربية' })
  if (await arBtn.count()) { await arBtn.click(); await page.waitForTimeout(800) }

  // in-dashboard, Arabic/RTL detail (not the raw English Frappe desk form)
  await expect(page.getByText('مقدّم الطلب').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('حالة الطلب')).toBeVisible() // admin status control present
  await expect(page.getByText('رقم الصك')).toBeVisible() // type-specific detail as Arabic label:value
  expect(page.url()).toContain('/real-estate/contracts/')
  expect(page.url()).not.toContain('/app/')

  // 4) update status New → Contacted from the detail; the "تم التواصل" step becomes active (disabled)
  const contacted = page.getByRole('button', { name: 'تم التواصل' })
  await contacted.click()
  await expect(contacted).toBeDisabled({ timeout: 10000 })
})
