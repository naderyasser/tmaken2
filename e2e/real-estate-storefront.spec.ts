import { test, expect } from '@playwright/test'

// Real E2E against the public storefront (:8080, marketplace mode, guest — no auth/mocks).
// Requires the storefront running with seeded demo data.
const STORE = process.env.STORE_URL || 'http://localhost:8080'

test.describe('Real Estate storefront (public)', () => {
  test('home renders branded, photo-led listings', async ({ page }) => {
    await page.goto(STORE + '/')
    await expect(page.locator('.aqar-store')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByText('سوقك العقاري الموثّق')).toBeVisible()
    // photo-led card grid
    const cards = page.locator('a[href^="/listing/"]')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(0)
    // at least one real photo
    await expect(page.locator('img[src*="/files/"]').first()).toBeVisible()
    // region chips with counts
    await expect(page.getByText('تصفّح حسب المنطقة')).toBeVisible()
  })

  test('listing detail shows REGA license block + QR', async ({ page }) => {
    await page.goto(STORE + '/')
    await page.locator('a[href^="/listing/"]').first().click()
    await expect(page.getByText('معلومات العقار حسب الرخصة')).toBeVisible()
    // QR (svg) present
    await expect(page.locator('svg').first()).toBeVisible()
    // JSON-LD structured data
    const ld = await page.locator('script[type="application/ld+json"]').count()
    expect(ld).toBeGreaterThan(0)
    // advertiser trust block
    await expect(page.getByText('المعلن').first()).toBeVisible()
  })

  test('search with filters returns results', async ({ page }) => {
    await page.goto(STORE + '/search?listing_type=Sale')
    await expect(page.getByText('نتائج البحث')).toBeVisible()
    const cards = page.locator('a[href^="/listing/"]')
    await expect(cards.first()).toBeVisible()
  })

  test('city landing page renders', async ({ page }) => {
    // CITY-3 = Riyadh in the seed
    await page.goto(STORE + '/CITY-3')
    await expect(page.locator('h1')).toContainText('عقارات')
  })

  test('post-ad wizard reachable (first step matches the phone-OTP flag)', async ({ page }) => {
    await page.goto(STORE + '/post')
    await expect(page.getByRole('heading', { name: 'أضف إعلانك' })).toBeVisible()
    // OTP on → 'تحقق الجوال'; OTP off (default) → contact-info step
    await expect(page.getByText(/تحقق الجوال|بيانات التواصل/).first()).toBeVisible()
  })
})
