import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE,'').slice(0,150)}`) })
async function go(p) { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1200) }
const report = (label) => { console.log(label, errors.length ? '\n   ' + [...new Set(errors)].join('\n   ') : '✓'); errors.length = 0 }

// A) add employee (full page form)
await go('/employee/new')
const code = 'E2E' + Date.now().toString().slice(-6)
await page.locator('input[placeholder="كود الموظف"]').fill(code)
await page.locator('input[placeholder="اسم الموظف بالعربية"]').fill('موظف اختبار')
// صلاحية الموظف بالفروع has a default; branch + shift are required selects
const branchSel = page.locator('select').filter({ hasText: 'الفروع' })
await branchSel.selectOption({ index: 1 }).catch(() => {})
const shiftSel = page.locator('select').filter({ hasText: 'الدوام' }).first()
await shiftSel.selectOption({ index: 1 }).catch(() => {})
await page.getByRole('button', { name: 'اضافة', exact: true }).click()
await page.waitForTimeout(2500)
console.log('after add employee: url=', page.url().replace(BASE, ''))
report('add-employee')

// B) edit the employee we just made (via list link)
await go('/employees')
await page.locator('input[placeholder="ابحث باسم او كود الموظف"]').fill(code)
await page.waitForTimeout(1000)
const link = page.getByRole('button', { name: 'موظف اختبار' })
if (await link.count()) {
  await link.first().click()
  await page.waitForTimeout(1500)
  console.log('edit page url=', page.url().replace(BASE, ''))
}
report('open-edit-employee')

// C) requests-settings + ramadan add buttons exist and open something
await go('/hr?module=requests-settings')
console.log('requests-settings body has content:', (await page.locator('body').innerText()).length > 200)
report('requests-settings')

await go('/hr?module=ramadan-schedule')
const ctaBtn = page.getByRole('button', { name: /تفعيل اول دوام رمضان/ })
console.log('ramadan CTA present:', await ctaBtn.count() > 0)
if (await ctaBtn.count()) { await ctaBtn.click(); await page.waitForTimeout(1000) }
report('ramadan-cta')

await browser.close()
