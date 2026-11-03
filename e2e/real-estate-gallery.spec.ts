import { test, expect } from '@playwright/test'

// Interactive listing gallery — discovers an Active multi-image listing dynamically
// (pinned fixtures expire via the license-expiry job, so never hardcode a listing name).
const STORE = process.env.STORE_URL || 'http://localhost:8080'
const API = `${STORE}/api/method/base_meena.real_estate.aqar_public_api`
const GALLERY = '[aria-roledescription="معرض صور"]'

test('multi-image gallery: arrows, thumbnails, dots, wrap-around, keyboard, lightbox', async ({ page, request }) => {
  const list = (await (await request.get(`${API}.search_listings?limit=50`)).json()).message.results
  let listing = ''
  let n = 0
  for (const r of list) {
    const d = (await (await request.get(`${API}.get_listing?name=${r.name}`)).json()).message
    if ((d.images || []).length >= 3) { listing = r.name; n = d.images.length; break }
  }
  test.skip(!listing, 'no Active listing with ≥3 images in the dataset')
  await page.goto(`${STORE}/listing/${listing}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'الصورة التالية' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: 'الصورة السابقة' })).toBeVisible()
  // n dots + n thumbnails = 2n "عرض الصورة رقم" controls
  await expect(page.getByRole('button', { name: /عرض الصورة رقم/ })).toHaveCount(n * 2)

  const mainSrc = () => page.locator(`${GALLERY} img`).first().getAttribute('src')
  const s0 = await mainSrc()
  // next changes the main image
  await page.getByRole('button', { name: 'الصورة التالية' }).first().click()
  await page.waitForTimeout(300)
  expect(await mainSrc()).not.toBe(s0)
  // thumbnail jump to the LAST image (labels use Arabic-Indic digits)
  const arDigits = (x: number) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
  await page.getByRole('button', { name: `عرض الصورة رقم ${arDigits(n)}` }).first().click()
  await page.waitForTimeout(300)
  // wrap-around: last image → next → image 1 (back to s0)
  await page.getByRole('button', { name: 'الصورة التالية' }).first().click()
  await page.waitForTimeout(300)
  expect(await mainSrc()).toBe(s0)
  // keyboard: ArrowLeft advances (RTL)
  await page.locator(GALLERY).focus()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  expect(await mainSrc()).not.toBe(s0)
  // lightbox
  await page.locator(`${GALLERY} button[aria-label="فتح الصورة بملء الشاشة"]`).click()
  await expect(page.getByRole('dialog', { name: /بملء الشاشة/ })).toBeVisible()
  await page.getByRole('button', { name: 'إغلاق المعرض' }).click()
  await expect(page.getByRole('dialog', { name: /بملء الشاشة/ })).toHaveCount(0)
  // favorite/share/compare untouched
  await expect(page.getByRole('button', { name: /المفضلة/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'مشاركة الإعلان', exact: true })).toBeVisible()
})

test('zero-image listing: branded placeholder, no gallery controls', async ({ page, request }) => {
  const list = (await (await request.get(`${API}.search_listings?limit=50`)).json()).message.results
  let zero = ''
  for (const r of list) {
    const d = (await (await request.get(`${API}.get_listing?name=${r.name}`)).json()).message
    if ((d.images || []).length === 0) { zero = r.name; break }
  }
  test.skip(!zero, 'no zero-image listing in the dataset')
  await page.goto(`${STORE}/listing/${zero}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('img', { name: 'لا توجد صورة لهذا العقار' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: 'الصورة التالية' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /عرض الصورة رقم/ })).toHaveCount(0)
})
