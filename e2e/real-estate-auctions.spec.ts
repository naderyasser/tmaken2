import { test, expect, request } from '@playwright/test'

// Auctions enhanced coming-soon: buyer/owner interest + partner forms submit and write the correct
// Aqar Lead topic + intent. Test leads carry the reserved marker so the backend flags is_test
// (no admin email, no throttle) and the afterAll teardown purges them — never polluting real leads.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-auctions.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const MARK = 'tamkeen-e2e.test' // reserved e2e marker (see submit_lead)
const CONTACT_RE = /رقم الجوال أو البريد الإلكتروني/

test.afterAll(async () => {
  // Teardown: remove only is_test=1 leads created by this suite (token-gated endpoint).
  const ctx = await request.newContext()
  await ctx.post(`${STORE}/api/method/base_meena.real_estate.aqar_public_api.purge_test_leads`, {
    form: { token: process.env.TEST_PURGE_TOKEN || '' },
  }).catch(() => {})
  await ctx.dispose()
})

test('static blocks render (how-it-works, sample preview, compliance)', async ({ page }) => {
  await page.goto(`${STORE}/auctions`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'كيف يعمل المزاد' })).toBeVisible()
  await expect(page.getByText('نموذج توضيحي')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'الامتثال والتنظيم' })).toBeVisible()
})

test('buyer interest submits with topic=Auctions, intent=Bidder', async ({ page }) => {
  await page.goto(`${STORE}/auctions`, { waitUntil: 'domcontentloaded' })
  const req = page.waitForRequest(/submit_lead/, { timeout: 8000 })
  await page.getByPlaceholder(CONTACT_RE).first().fill(`bidder@${MARK}`)
  await page.getByRole('button', { name: 'سجّل اهتمامي' }).click()
  const body = (await req).postData() || ''
  expect(body).toContain('Auctions')
  expect(body).toContain('Bidder')
  await expect(page.getByText('تم استلام طلبك')).toBeVisible({ timeout: 6000 })
})

test('owner interest submits with intent=Owner', async ({ page }) => {
  await page.goto(`${STORE}/auctions`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'مالك عقار يريد البيع بالمزاد' }).click()
  const req = page.waitForRequest(/submit_lead/, { timeout: 8000 })
  await page.getByPlaceholder(CONTACT_RE).first().fill(`owner@${MARK}`)
  await page.getByRole('button', { name: 'سجّل اهتمامي' }).click()
  expect((await req).postData() || '').toContain('Owner')
  await expect(page.getByText('تم استلام طلبك')).toBeVisible({ timeout: 6000 })
})

test('partner form submits with intent=Partner', async ({ page }) => {
  await page.goto(`${STORE}/auctions`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('اسم شركة المزادات').fill('شركة مزادات تجريبية')
  const req = page.waitForRequest(/submit_lead/, { timeout: 8000 })
  // second contact field on the page belongs to the partner form
  await page.getByPlaceholder(CONTACT_RE).nth(1).fill(`partner@${MARK}`)
  await page.getByRole('button', { name: 'أرسل طلب الشراكة' }).click()
  const body = (await req).postData() || ''
  expect(body).toContain('Auctions')
  expect(body).toContain('Partner')
  await expect(page.getByText('تم استلام طلبك')).toBeVisible({ timeout: 6000 })
})
