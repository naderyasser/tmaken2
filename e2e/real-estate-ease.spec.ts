import { test, expect } from '@playwright/test'

// Ease-of-use pass: contact CTAs (واتساب primary + اتصال) on cards + detail, persistent help FAB,
// search progressive disclosure (فلاتر أكثر), friendly empty state + مسح الفلاتر, and the post-flow
// affordances. No lead/listing writes here (CTAs are server redirects; post checks are UI-only).
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-ease.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'

test('contact CTAs on cards: واتساب + اتصال via server redirects', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  const card = page.locator('.aqar-card').first()
  await expect(card).toBeVisible({ timeout: 8000 })
  await expect(card.getByRole('link', { name: 'واتساب' })).toHaveAttribute('href', /wa_redirect\?listing=/)
  await expect(card.getByRole('link', { name: 'اتصال' })).toHaveAttribute('href', /call_redirect\?listing=/)
})

test('persistent help FAB opens WhatsApp support', async ({ page }) => {
  await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: /محتاج مساعدة/ })).toHaveAttribute('href', /wa\.me\/966553275000/)
})

test('listing detail has واتساب + اتصال above the fold', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'domcontentloaded' })
  const first = page.locator('a[href^="/listing/"]').first()
  await expect(first).toBeVisible({ timeout: 8000 })
  await first.click()
  await page.waitForURL(/\/listing\//, { timeout: 8000 })
  await expect(page.getByRole('link', { name: 'واتساب' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'اتصال' }).first()).toBeVisible()
})

test('quick filters always visible; less-common (القسم) behind فلاتر أكثر', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'domcontentloaded' })
  // F1: price/area quick filters are now always visible (no extra click)
  await expect(page.getByPlaceholder('أقل سعر')).toBeVisible()
  await expect(page.getByPlaceholder('أقل مساحة (م²)')).toBeVisible()
  // the less-common القسم filter stays behind «فلاتر أكثر»
  await expect(page.getByLabel('القسم')).toHaveCount(0)
  await page.getByRole('button', { name: /فلاتر أكثر/ }).click()
  await expect(page.getByLabel('القسم')).toBeVisible()
})

test('friendly empty state offers مسح الفلاتر and recovers', async ({ page }) => {
  await page.goto(`${STORE}/search?price_max=1`, { waitUntil: 'domcontentloaded' })
  const clear = page.getByRole('button', { name: 'مسح الفلاتر' })
  await expect(clear).toBeVisible({ timeout: 8000 })
  await clear.click()
  // after clearing, results come back (no longer the empty message)
  await expect(page.locator('[data-id]').first()).toBeVisible({ timeout: 8000 })
})

test('post flow: stepper, assisted WhatsApp, and what-you-need are present', async ({ page }) => {
  await page.goto(`${STORE}/post`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/تحقق الجوال|بيانات التواصل/).first()).toBeVisible() // stepper (label depends on the phone-OTP flag)
  await expect(page.getByText(/تحتاج مساعدة في النشر/)).toBeVisible()            // assisted option
  await expect(page.getByText('ماذا ستحتاج للنشر؟')).toBeVisible()
})
