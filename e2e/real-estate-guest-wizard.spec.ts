import { test, expect, request as pwRequest } from '@playwright/test'

// Guest wizard parity (phone-OTP DISABLED — the default): contact info → details → map →
// multi-photos → license → submit-for-review. The listing must land in the manual-review
// state (Pending License) and must NOT be publicly visible until the team publishes it.
// Plus: a sparse listing (no images/coords) renders without crashing.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-guest-wizard.spec.ts --project=chromium
// Cleanup after: bench --site qarawi execute base_meena.real_estate.demo_seed.delete_demo_data  (or remove PWWIZARD by title)

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const MARK = `PWWIZARD ${Date.now().toString().slice(-7)}`

test('guest wizard happy path → listing goes to review (not public), no console errors', async ({ page }) => {
  test.setTimeout(150_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(`${STORE}/post`, { waitUntil: 'domcontentloaded' })
  // Step 0 — contact info (no OTP: phone is contact-only, no code is sent or asked for)
  await page.getByPlaceholder('+9665XXXXXXXX').fill('+966500778899')
  await expect(page.getByText('وضع تجريبي')).toHaveCount(0)
  await page.getByRole('button', { name: 'متابعة' }).click()

  // details
  await page.getByPlaceholder('عنوان الإعلان').fill(`${MARK} شقة`)
  const selects = page.locator('.aqar-card select')
  await selects.nth(0).selectOption({ index: 1 })        // category
  await selects.nth(1).selectOption('Sale')               // type
  await page.getByPlaceholder('السعر').fill('650000')
  await page.getByPlaceholder('المساحة م²').fill('180')
  await page.getByPlaceholder('غرف').fill('3')
  await page.getByPlaceholder('دورات مياه').fill('2')
  // region → city populate the dependent chain (selected by their placeholder option text)
  const region = page.locator('select:has(option:text-is("المنطقة"))')
  await region.selectOption({ index: 1 })
  const city = page.locator('select:has(option:text-is("المدينة"))')
  await expect.poll(async () => city.locator('option').count()).toBeGreaterThan(1)
  await city.selectOption({ index: 1 })
  // toggle first service chip if any
  const chip = page.locator('button', { hasText: /كهرباء|مياه/ }).first()
  if (await chip.count()) await chip.click()
  await page.getByRole('button', { name: /التالي: الموقع/ }).click()

  // map
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /التالي: الصور/ }).click()

  // photos — upload 2
  await page.locator('input[type="file"]').setInputFiles(['/tmp/p1img1.png', '/tmp/p1img2.png'])
  await expect.poll(async () => page.locator('.aqar-card img').count()).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: /التالي: الترخيص/ }).click()

  // license + submit for review (capture the publish API response for the listing name)
  await page.getByPlaceholder('رقم الترخيص الإعلاني').fill('7779001')
  await page.locator('input[type="date"]').fill('2027-12-31')
  const pubResp = page.waitForResponse((r) => r.url().includes('guest_publish') && r.status() === 200)
  await page.getByRole('button', { name: 'إرسال للمراجعة' }).click()

  // Review state confirmed in plain Arabic — no "live" claim, no view link
  await expect(page.getByText('إعلانك تحت المراجعة')).toBeVisible({ timeout: 30000 })
  const pub = (await (await pubResp).json())?.message
  expect(pub?.status).toBe('Pending License')
  const listing = pub?.listing as string
  expect(listing).toBeTruthy()

  // Cross-side proof: the pending listing is NOT publicly visible (get_listing only
  // serves Active listings) — nothing goes live without the team's approval.
  const api = await pwRequest.newContext({ extraHTTPHeaders: { 'X-Marketplace': '1' } })
  const res = await api.get(`${STORE}/api/method/base_meena.real_estate.aqar_public_api.get_listing?name=${listing}`)
  expect(res.ok()).toBeFalsy()
  await api.dispose()

  expect(errors, errors.join(' | ')).toHaveLength(0)
})

test('sparse listing (no images, no coords) renders without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const resp = await page.goto(`${STORE}/listing/AQAR-00917`, { waitUntil: 'networkidle' })
  expect(resp?.status()).toBe(200)
  await expect(page.locator('.aqar-store')).toBeVisible()
  expect(errors, errors.join(' | ')).toHaveLength(0)
})
