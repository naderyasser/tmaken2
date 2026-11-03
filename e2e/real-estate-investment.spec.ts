import { test, expect } from '@playwright/test'

// Investment hub: estimate metrics render, honest "غير متوفر" fallback, the disclaimer is present
// on the hub AND on a Sale listing-detail investment panel, and lands are framed by resale.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-investment.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'

test('hub: disclaimer + curated cards + price/m² + honest fallback', async ({ page }) => {
  await page.goto(`${STORE}/investment`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('إخلاء مسؤولية')).toBeVisible()
  await expect(page.locator('a.aqar-card').first()).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('السعر/م²').first()).toBeVisible()
  // either a computed yield (X.X%) or the honest non-fabricated fallback must appear
  const html = await page.content()
  expect(/\d\.\d%/.test(html) || html.includes('غير متوفر') || html.includes('—')).toBeTruthy()
})

test('hub: lands framed as resale, not rental yield', async ({ page }) => {
  await page.goto(`${STORE}/investment?category=Lands`, { waitUntil: 'domcontentloaded' })
  if ((await page.locator('a.aqar-card').count()) > 0) {
    await expect(page.getByText('إعادة البيع').first()).toBeVisible()
    await expect(page.getByText('العائد الإجمالي')).toHaveCount(0) // no rental-yield metric on lands
  }
})

test('hub: min-yield + sort filters keep the page working (URL-state)', async ({ page }) => {
  await page.goto(`${STORE}/investment?min_yield=3&sort=yield`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('إخلاء مسؤولية')).toBeVisible()
  await expect(page.getByPlaceholder('أدنى عائد %')).toBeVisible()
})

test('disclaimer also appears on a Sale listing-detail investment panel', async ({ page }) => {
  await page.goto(`${STORE}/investment`, { waitUntil: 'domcontentloaded' })
  const first = page.locator('a.aqar-card').first()
  await expect(first).toBeVisible({ timeout: 8000 })
  await first.click()
  await page.waitForURL(/\/listing\//, { timeout: 8000 })
  await expect(page.getByText('المؤشّرات الاستثمارية')).toBeVisible({ timeout: 8000 })
  // disclaimer present (match a tanween-free fragment of the compact disclaimer)
  await expect(page.getByText('بيانات الإعلانات', { exact: false }).first()).toBeVisible()
})
