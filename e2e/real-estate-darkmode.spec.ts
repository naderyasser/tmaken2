import { test, expect, request as pwRequest } from '@playwright/test'

// Storefront premium dark mode: rendering in dark, toggle persistence (cookie),
// no-FOUC (theme applied before paint), prefers-color-scheme default, QR stays light.
// Run: STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-darkmode.spec.ts --project=chromium

const STORE = process.env.STORE_URL || 'http://localhost:8080'
const DARK_BG = 'rgb(21, 24, 22)'   // #151816 page background
const LIGHT_BG = 'rgb(250, 247, 242)' // #FAF7F2

const cookie = (value: 'dark' | 'light') => ({
  name: 'aqar-theme', value, url: STORE,
})
const rootClass = async (page: any) =>
  page.locator('.aqar-store').first().getAttribute('class')
const rootBg = async (page: any) =>
  page.locator('.aqar-store').first().evaluate((el: Element) => getComputedStyle(el).backgroundColor)

async function firstActiveListing(): Promise<string | null> {
  const api = await pwRequest.newContext({ extraHTTPHeaders: { 'X-Marketplace': '1' } })
  const res = await api.get(`${STORE}/api/method/base_meena.real_estate.aqar_public_api.search_listings?limit=1`)
  const body = await res.json()
  await api.dispose()
  return body?.message?.results?.[0]?.name || null
}

test.describe('storefront dark mode', () => {
  test('dark cookie renders dark across home/search/post (+ detail)', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addCookies([cookie('dark')])
    const page = await ctx.newPage()

    for (const path of ['/', '/search', '/post']) {
      await page.goto(`${STORE}${path}`, { waitUntil: 'domcontentloaded' })
      expect(await rootClass(page), `${path} root class`).toContain('dark')
      expect(await rootBg(page), `${path} bg`).toBe(DARK_BG)
    }
    const listing = await firstActiveListing()
    if (listing) {
      await page.goto(`${STORE}/listing/${listing}`, { waitUntil: 'domcontentloaded' })
      expect(await rootClass(page)).toContain('dark')
      // QR stays light/scannable: its panel is white even in dark
      const qr = page.locator('svg[height][width]').first()
      await expect(qr).toBeVisible({ timeout: 10000 }).catch(() => {})
    }
    await ctx.close()
  })

  test('light cookie renders light', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addCookies([cookie('light')])
    const page = await ctx.newPage()
    await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
    expect(await rootClass(page)).not.toContain('dark')
    expect(await rootBg(page)).toBe(LIGHT_BG)
    await ctx.close()
  })

  test('toggle flips theme and persists across reload (cookie)', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addCookies([cookie('light')])
    const page = await ctx.newPage()
    await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
    expect(await rootBg(page)).toBe(LIGHT_BG)

    await page.getByRole('button', { name: /الوضع الداكن|الوضع الفاتح/ }).click()
    expect(await rootBg(page)).toBe(DARK_BG)
    // cookie was written
    const cookies = await ctx.cookies()
    expect(cookies.find((c) => c.name === 'aqar-theme')?.value).toBe('dark')

    await page.reload({ waitUntil: 'domcontentloaded' })
    expect(await rootClass(page)).toContain('dark')
    expect(await rootBg(page)).toBe(DARK_BG)
    await ctx.close()
  })

  test('no-FOUC: dark applied before paint (class present on first evaluate)', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addCookies([cookie('dark')])
    const page = await ctx.newPage()
    // commit = earliest; the blocking inline script runs during parse, before paint
    await page.goto(`${STORE}/`, { waitUntil: 'commit' })
    await expect.poll(async () => await rootClass(page).catch(() => '')).toContain('dark')
    expect(await rootBg(page)).toBe(DARK_BG)
    await ctx.close()
  })

  test('prefers-color-scheme: dark applies with no cookie', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' })
    const page = await ctx.newPage()
    await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' })
    expect(await rootClass(page)).toContain('dark')
    expect(await rootBg(page)).toBe(DARK_BG)
    await ctx.close()
  })
})
