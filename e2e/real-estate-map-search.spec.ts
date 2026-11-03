import { test, expect } from '@playwright/test'

// Flagship split map search: pins/clusters render, hover sync, search-as-you-move re-query,
// reduced-motion safe.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-map-search.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'

test('pins/clusters + results list render with no errors', async ({ page }) => {
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await expect(page.locator('.leaflet-container')).toBeVisible()
  const pins = await page.locator('.aqar-pin').count()
  const clusters = await page.locator('.aqar-cluster').count()
  expect(pins + clusters).toBeGreaterThan(0)
  expect(await page.locator('[data-id]').count()).toBeGreaterThan(0)
  expect(errs, errs.join(' | ')).toHaveLength(0)
})

test('hovering a result card highlights it (sync state)', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const card = page.locator('[data-id]').first()
  await card.hover()
  // active card gets the green border token class
  await expect(card).toHaveClass(/border-\[var\(--aqar-green\)\]/)
})

test('search-as-you-move re-queries on map move (debounced)', async ({ page }) => {
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const req = page.waitForRequest(/aqar_public_api\.search_in_bounds/, { timeout: 8000 })
  await page.locator('.leaflet-control-zoom-in').click()   // triggers moveend → debounced bounds query
  await req // fired
  await page.waitForTimeout(700)
  await expect(page.locator('.leaflet-container')).toBeVisible()
})

test('reduced-motion: pins still render, page stable', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`${STORE}/search`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  expect(await page.locator('.aqar-pin, .aqar-cluster').count()).toBeGreaterThan(0)
  expect(errs, errs.join(' | ')).toHaveLength(0)
  await ctx.close()
})
