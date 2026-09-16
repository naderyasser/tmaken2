import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) console.log('HTTP', r.status(), r.request().method(), r.url().replace(BASE,'').slice(0,150)) })
await page.goto(BASE + '/employee/new', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1000)
const code = 'E2E' + Date.now().toString().slice(-6)
await page.locator('input[placeholder="كود الموظف"]').fill(code)
await page.locator('input[placeholder="اسم الموظف بالعربية"]').fill('موظف اختبار')
const selects = page.locator('select')
await selects.nth(3).selectOption({ index: 1 }) // الفروع
await selects.nth(4).selectOption({ index: 1 }) // الدوام
await page.waitForTimeout(300)
// listen for the toast text if validation fails
const btn = page.getByRole('button', { name: 'اضافة', exact: true })
await btn.click()
await page.waitForTimeout(2500)
console.log('url after save:', page.url().replace(BASE, ''))
const toastText = await page.locator('[role=status], [class*=toast]').allTextContents().catch(() => [])
console.log('toast:', toastText)
await browser.close()
