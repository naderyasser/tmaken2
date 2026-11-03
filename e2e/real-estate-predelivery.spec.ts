import { test, expect } from '@playwright/test'

// Pre-delivery fixes: dark-mode persistence, count↔list agreement, CSRF-once, page titles.
const STORE = process.env.STORE_URL || 'http://localhost:8080'

const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'

test('FIX1: theme toggle sets <html data-theme>, persists to localStorage, survives reload', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /الوضع الداكن/ }).click()
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => localStorage.getItem('aqar_theme'))).toBe('dark')
  expect(await page.evaluate(isDark)).toBe(true)
  // surfaces actually flip (token-driven)
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.aqar-store')!).backgroundColor)
  expect(bg).not.toBe('rgb(250, 247, 242)') // not the light sand
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  expect(await page.evaluate(isDark)).toBe(true) // no FOUC reset
})

test('FIX1: a visitor whose OS prefers dark gets dark by default', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', ignoreHTTPSErrors: true })
  const p = await ctx.newPage()
  await p.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(600)
  expect(await p.evaluate(isDark)).toBe(true)
  await ctx.close()
})

test('FIX2: count badge and list agree on a zero-result query', async ({ page }) => {
  await page.goto(`${STORE}/search?price_max=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await expect(page.getByRole('button', { name: 'مسح الفلاتر' })).toBeVisible({ timeout: 8000 }) // empty state shown
  await expect(page.locator('span.tabular-nums').first()).toHaveText('0') // count = 0, not a stale positive
  await page.getByRole('button', { name: 'مسح الفلاتر' }).click()
  await page.waitForTimeout(1500)
  expect(Number(await page.locator('span.tabular-nums').first().innerText())).toBeGreaterThan(0)
})

test('FIX4: empty-in-bounds shows a bounds-specific message + working «expand» action', async ({ page }) => {
  await page.goto(`${STORE}/search?price_max=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // map-bounds search is on by default → bounds-specific message + expand action
  await expect(page.getByText('ما فيه عروض داخل حدود الخريطة الحالية')).toBeVisible({ timeout: 8000 })
  const expand = page.getByRole('button', { name: 'توسيع نطاق البحث' })
  await expect(expand).toBeVisible()
  await expand.click() // disables bounds filtering — the bounds message must go away
  await page.waitForTimeout(1500)
  await expect(page.getByText('ما فيه عروض داخل حدود الخريطة الحالية')).toHaveCount(0)
})

test('FIX3: CSRF token is fetched at most once across multiple filter re-queries', async ({ page }) => {
  let csrf = 0
  page.on('request', (r) => { if (r.url().includes('get_csrf_token')) csrf++ })
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.getByPlaceholder('أقل سعر').fill('100000')
  await page.waitForTimeout(900)
  await page.getByPlaceholder('أعلى سعر').fill('900000')
  await page.waitForTimeout(900)
  await page.getByLabel('ترتيب النتائج').selectOption('price_asc')
  await page.waitForTimeout(900)
  expect(csrf).toBeLessThanOrEqual(1) // cached for the session, not re-fetched per call
})

test('FIX5: secondary pages have unique Arabic titles', async ({ page }) => {
  await page.goto(`${STORE}/favorites`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle('المفضلة | تمكين العقارية')
  await page.goto(`${STORE}/compare`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle('مقارنة العقارات | تمكين العقارية')
  await page.goto(`${STORE}/saved-searches`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle('عمليات البحث المحفوظة | تمكين العقارية')
})
