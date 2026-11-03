import { test, expect } from '@playwright/test'

// UX pass: always-visible quick filters + chips, favorites, sort, share, موثّق badge, compare.
// All user data is localStorage-only (no accounts/writes) — each test gets a fresh context.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-ux-features.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'

test('F1: quick filters are always visible, sync to URL, and chip removal works', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await expect(page.getByPlaceholder('أقل سعر')).toBeVisible()
  await expect(page.getByPlaceholder('أقل مساحة (م²)')).toBeVisible()
  await page.getByPlaceholder('أقل سعر').fill('100000')
  await page.waitForTimeout(700)
  await expect(page).toHaveURL(/price_min=100000/)
  const chip = page.getByRole('button', { name: /إزالة الفلتر/ })
  await expect(chip.first()).toBeVisible()
  await chip.first().click()
  await page.waitForTimeout(500)
  await expect(page).not.toHaveURL(/price_min=100000/) // chip removed the filter
})

test('F3: sort dropdown reflects to the URL', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.getByLabel('ترتيب النتائج').selectOption('price_asc')
  await page.waitForTimeout(700)
  await expect(page).toHaveURL(/sort=price_asc/)
})

test('F2: favorite toggles, persists, shows on /favorites, and badges the header', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'networkidle' })
  await page.getByLabel('إضافة إلى المفضلة').first().click()
  await page.waitForTimeout(300)
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('aqar_favorites') || '[]').length)
  expect(n).toBe(1)
  await expect(page.getByLabel(/المفضلة، .* محفوظ/)).toBeVisible() // header badge label reflects count
  await page.goto(`${STORE}/favorites`, { waitUntil: 'networkidle' })
  await expect(page.locator('.aqar-card')).toHaveCount(1)
})

test('F2: empty favorites shows the empty state + CTA', async ({ page }) => {
  await page.goto(`${STORE}/favorites`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('لا توجد عقارات محفوظة بعد')).toBeVisible()
  await expect(page.getByRole('link', { name: /تصفّح العقارات/ })).toBeVisible()
})

test('F5: موثّق badge renders on cards', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'networkidle' })
  expect(await page.getByText('موثّق').count()).toBeGreaterThan(0)
})

test('F6: compare adds, shows the sticky bar, caps at 3, and renders the table', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'networkidle' })
  const add = page.getByRole('button', { name: 'أضف إلى المقارنة' })
  for (let i = 0; i < 4; i++) await add.nth(i).click() // 4th should be capped
  await page.waitForTimeout(400)
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('aqar_compare') || '[]').length)
  expect(n).toBe(3) // COMPARE_MAX enforced
  await expect(page.getByRole('region', { name: 'شريط المقارنة' })).toBeVisible()
  await page.goto(`${STORE}/compare`, { waitUntil: 'networkidle' })
  await expect(page.getByText('السعر/م²')).toBeVisible()
  await expect(page.getByText('حالة الترخيص')).toBeVisible()
})

// ---------------- Phase B ----------------
test('B1: compare highlights the best cell per row (accessible)', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    const x = [
      { name: 'A', title: 'عقار أ', price: 1000000, area_sqm: 200, bedrooms: 4, rega_ad_license_number: '1' },
      { name: 'B', title: 'عقار ب', price: 2000000, area_sqm: 300, bedrooms: 3 },
    ]
    localStorage.setItem('aqar_compare', JSON.stringify(x))
  })
  await page.goto(`${STORE}/compare`, { waitUntil: 'networkidle' })
  // A wins price + rooms + price/m²; B wins area → 4 «الأفضل» markers
  await expect(page.getByText('الأفضل', { exact: true })).toHaveCount(4)
  await expect(page.getByText('الأفضل سعراً', { exact: true })).toHaveCount(1) // sr-only contextual label
})

test('B1: no highlight with a single listing', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.setItem('aqar_compare', JSON.stringify([{ name: 'A', title: 'عقار', price: 1000000, area_sqm: 200, bedrooms: 4 }])))
  await page.goto(`${STORE}/compare`, { waitUntil: 'networkidle' })
  await expect(page.getByText('الأفضل', { exact: true })).toHaveCount(0)
})

test('B2: cards show جديد + views', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'networkidle' })
  expect(await page.getByText('جديد', { exact: true }).count()).toBeGreaterThan(0)
  expect(await page.getByText(/مشاهدة/).count()).toBeGreaterThan(0)
})

test('B4: save a search → appears on /saved-searches → reopens with the same query; alert intent persists', async ({ page }) => {
  await page.goto(`${STORE}/search?listing_type=Sale&bedrooms_min=3`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'احفظ هذا البحث' }).click()
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aqar_saved_searches') || '[]').length)).toBe(1)
  await page.goto(`${STORE}/saved-searches`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.aqar-card')).toHaveCount(1)
  await expect(page.getByRole('link', { name: /فتح/ })).toHaveAttribute('href', '/search?listing_type=Sale&bedrooms_min=3')
  await page.getByRole('button', { name: /نزول عقار مطابق/ }).click()
  await expect(page.getByText(/خدمة إشعارات/)).toBeVisible() // backend-needed note
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aqar_saved_searches') || '[]')[0].alert)).toBe(true)
})

test('B5: shareable image button generates without error', async ({ page }) => {
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await page.goto(`${STORE}/search?listing_type=Sale`, { waitUntil: 'domcontentloaded' })
  const first = page.locator('a[href^="/listing/"]').first()
  await expect(first).toBeVisible({ timeout: 8000 })
  await first.click()
  await page.waitForURL(/\/listing\//, { timeout: 8000 })
  const btn = page.getByRole('button', { name: 'مشاركة الإعلان كصورة' })
  await expect(btn).toBeVisible()
  await btn.click()
  await page.waitForTimeout(2500)
  expect(errs).toHaveLength(0)
})

test('F4/A4: share fallback (navigator.share stubbed undefined) — menu, copy toast, WhatsApp', async ({ page, context }) => {
  // Force the fallback path even on browsers that DO support Web Share.
  await context.addInitScript(() => {
    try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) } catch { /* */ }
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.goto(`${STORE}/search`, { waitUntil: 'domcontentloaded' })
  const first = page.locator('a[href^="/listing/"]').first()
  await expect(first).toBeVisible({ timeout: 8000 })
  await first.click()
  await page.waitForURL(/\/listing\//, { timeout: 8000 })

  const share = page.getByRole('button', { name: 'مشاركة الإعلان', exact: true }) // not the «…كصورة» button
  await expect(share).toBeVisible()
  await share.click() // no navigator.share → fallback menu
  await expect(page.getByRole('menuitem', { name: /نسخ الرابط/ })).toBeVisible()
  // WhatsApp link is prefilled with the canonical URL + opens safely (rel=noopener)
  const listingId = page.url().split('/listing/')[1].split(/[?#]/)[0]
  const wa = page.getByRole('menuitem', { name: /واتساب/ })
  await expect(wa).toHaveAttribute('href', /wa\.me\/\?text=/)
  await expect(wa).toHaveAttribute('rel', /noopener/)
  await expect(wa).toHaveAttribute('href', new RegExp(listingId)) // prefilled text contains the listing URL
  // copy-link shows a success toast
  await page.getByRole('menuitem', { name: /نسخ الرابط/ }).click()
  await expect(page.getByText('تم نسخ الرابط ✅')).toBeVisible({ timeout: 5000 })
})
