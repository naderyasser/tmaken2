import { test, expect } from '@playwright/test'

// Smart-search autocomplete on the storefront hero.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-search.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const box = (page: any) => page.locator('input[role="combobox"]').first()

test('typing بريده suggests بريدة (Arabic-normalized) under مدن', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await box(page).fill('بريده')
  await expect(page.getByText('مدن')).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: /بريدة/ }).first()).toBeVisible()
})

test('keyboard ↓ + Enter selects a suggestion and navigates', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await box(page).fill('بريده')
  await expect(page.getByRole('button', { name: /بريدة/ }).first()).toBeVisible({ timeout: 8000 })
  await box(page).press('ArrowDown')
  await box(page).press('Enter')
  await page.waitForURL((u) => u.pathname !== '/' , { timeout: 8000 })
  expect(page.url()).not.toMatch(/\/$/)
  await expect(page.locator('.aqar-store')).toBeVisible()
})

test('plain free-text Enter (no selection) runs a full search', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await box(page).fill('عقار زززلا يوجد')
  await box(page).press('Enter')         // no highlighted item → native form submit
  await page.waitForURL(/\/search\?/, { timeout: 8000 })
  expect(page.url()).toContain('keyword=')
})

test('dropdown works in dark theme', async ({ browser }) => {
  const ctx = await browser.newContext()
  await ctx.addCookies([{ name: 'aqar-theme', value: 'dark', url: STORE }])
  const page = await ctx.newPage()
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[role="combobox"]').first().fill('بريده')
  await expect(page.getByText('مدن')).toBeVisible({ timeout: 8000 })
  await ctx.close()
})
