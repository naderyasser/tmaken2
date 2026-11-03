import { test, expect, request as pwRequest } from '@playwright/test'

// Integration (UI): Storefront → ERP, with phone-OTP DISABLED (the default — no SMS
// provider). Drives the REAL /post wizard: contact info (no OTP), details, license,
// submit-for-review. Proves the listing reached the ERP in the manual-review state
// (Pending License) and is NOT publicly queryable until the team publishes it.
// API-level cross-side assertions live in base_meena.real_estate.integration_test (bench).
//
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-integration.spec.ts --project=chromium
// Cleanup the created ad afterwards:
//   bench --site qarawi execute base_meena.real_estate.integration_test.cleanup_pw

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const MARK = `INTG-PW ${Date.now().toString().slice(-7)}`

test('Guest posts an ad through the /post UI → it lands in review, not live (storefront → ERP)', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto(`${STORE}/post`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'أضف إعلانك' })).toBeVisible()

  // Step 0 — contact info (no OTP step, no code prompt anywhere)
  await page.getByPlaceholder('+9665XXXXXXXX').fill('+966500112233')
  await page.getByPlaceholder('اسم المعلن').fill('INTG PW معلن')
  await expect(page.getByText('وضع تجريبي')).toHaveCount(0)
  await page.getByRole('button', { name: 'متابعة' }).click()

  // Step 1 — details
  await page.getByPlaceholder('عنوان الإعلان').fill(`${MARK} شقة`)
  const selects = page.locator('.aqar-card select')
  await selects.nth(0).selectOption({ index: 1 })           // category
  await selects.nth(1).selectOption('Sale')                  // listing type
  await page.getByPlaceholder('السعر').fill('650000')
  await page.getByPlaceholder('المساحة م²').fill('150')
  const region = page.locator('select:has(option:text-is("المنطقة"))')
  await region.selectOption({ index: 1 })
  const city = page.locator('select:has(option:text-is("المدينة"))')
  await expect.poll(async () => city.locator('option').count(), { timeout: 15_000 }).toBeGreaterThan(1)
  await city.selectOption({ index: 1 })
  await page.getByPlaceholder('الوصف').fill('INTG PW integration ad')
  await page.getByRole('button', { name: /التالي: الموقع/ }).click()

  // Step 2 — map (keep default pin)
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /التالي: الصور/ }).click()

  // Step 3 — photos (optional; skip straight to license)
  await page.getByRole('button', { name: /التالي: الترخيص/ }).click()

  // Step 4 — REGA license → submit for review
  await page.getByPlaceholder('رقم الترخيص الإعلاني').fill('7777001')
  await page.locator('input[type="date"]').fill('2027-12-31')
  await page.getByPlaceholder('صاحب الترخيص').fill('INTG PW Licensee')
  await page.getByPlaceholder('رقم الصك').fill('INTG-PW-DEED')
  const pubResp = page.waitForResponse((r) => r.url().includes('guest_publish') && r.status() === 200)
  await page.getByRole('button', { name: 'إرسال للمراجعة' }).click()

  // Step 5 — review confirmation (no "live" claim, no view link)
  await expect(page.getByText('إعلانك تحت المراجعة')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'عرض الإعلان' })).toHaveCount(0)

  // Cross-side proof: the ERP holds it as Pending License…
  const pub = (await (await pubResp).json())?.message
  expect(pub?.status).toBe('Pending License')
  const listing = pub?.listing as string
  expect(listing).toBeTruthy()

  // …and the public storefront API does NOT expose it (only Active listings are served).
  const api = await pwRequest.newContext({ extraHTTPHeaders: { 'X-Marketplace': '1' } })
  const res = await api.get(`${STORE}/api/method/base_meena.real_estate.aqar_public_api.get_listing?name=${listing}`)
  expect(res.ok()).toBeFalsy()
  await api.dispose()
})
