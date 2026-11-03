import { test, expect, type Page } from '@playwright/test'

/**
 * Cashier sub-page localization probe (Issue 1).
 *
 * Asserts that /cashier/history, /close, /returns and /reports render with ZERO Arabic
 * characters in ENGLISH mode (master data — item/customer/payment-method names and
 * server document ids — excluded), and that core Arabic labels render in ARABIC mode.
 * Also asserts dir follows the language on each page root.
 *
 * Run like cashier-offline.spec.ts (needs the POS cashier fixture user); skips without
 * E2E_CASHIER_PASSWORD.
 */

const URL_BASE = process.env.CASHIER_E2E_URL || 'https://qarawi.base.meena.sa'
const USER = process.env.E2E_CASHIER_USER || 'pos.e2e.cashier@test.local'
const PW = process.env.E2E_CASHIER_PASSWORD || ''

test.use({
  baseURL: URL_BASE,
  ignoreHTTPSErrors: true,
  launchOptions: { args: ['--host-resolver-rules=MAP qarawi.base.meena.sa 127.0.0.1'] },
})

test.skip(!PW, 'E2E_CASHIER_PASSWORD not set — cashier i18n suite skipped')

const ROUTES = ['/cashier/history', '/cashier/close', '/cashier/returns', '/cashier/reports']

// Master data that legitimately stays Arabic in EN mode (DB content, not UI strings)
const DATA_ALLOW = [
  /خدمة اختبار/,        // test item name
  /بطاقة ائتمان|نقدي/,  // Mode of Payment names from ERPNext masters
  /القرعاوي|عثمان/,      // company / warehouse names
]

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="text"]').first().fill(USER)
  await page.locator('input[type="password"]').first().fill(PW)
  await page.getByRole('button', { name: /sign in|login|تسجيل/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
}

const setLang = (page: Page, lang: 'ar' | 'en') =>
  page.evaluate((l) => localStorage.setItem('meena-lang', l), lang)

test('EN mode renders ZERO Arabic UI text on all four sub-pages (and dir=ltr)', async ({ page }) => {
  test.setTimeout(150_000)
  await login(page)
  await setLang(page, 'en')
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const text = await page.evaluate(() => document.body.innerText)
    const leftovers = [...new Set((text.match(/[؀-ۿ][؀-ۿ\s٠-٩.,]{1,60}/g) || []).map((x) => x.trim()))]
      .filter((x) => x && !DATA_ALLOW.some((re) => re.test(x)))
    expect(leftovers, `${route} EN leftovers: ${leftovers.join(' | ')}`).toEqual([])
    // dir follows the language on the page container
    const dir = await page.locator('[dir]').first().getAttribute('dir')
    expect(dir, `${route} dir`).toBe('ltr')
  }
})

test('AR mode renders Arabic labels (and dir=rtl) on all four sub-pages', async ({ page }) => {
  test.setTimeout(150_000)
  await login(page)
  await setLang(page, 'ar')
  const expectAr: Record<string, RegExp> = {
    '/cashier/history': /سجل الفواتير|الفواتير/,
    '/cashier/close': /إغلاق الجلسة|المتوقع/,
    '/cashier/returns': /إرجاع|المرتجعات/,
    '/cashier/reports': /تقرير الجلسة|إجمالي المبيعات/,
  }
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const text = await page.evaluate(() => document.body.innerText)
    expect(text, `${route} should show Arabic UI`).toMatch(expectAr[route])
    const dir = await page.locator('[dir]').first().getAttribute('dir')
    expect(dir, `${route} dir`).toBe('rtl')
  }
})
