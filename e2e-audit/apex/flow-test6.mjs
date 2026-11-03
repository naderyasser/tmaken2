import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
let errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE,'').slice(0,150)}`) })
async function go(p) { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1200) }
const report = (label) => { console.log(label, errors.length ? '\n   ' + [...new Set(errors)].join('\n   ') : '✓'); errors = [] }

// add-leave: employee link select + leave type select + dates
await go('/hr?module=add-leave')
await page.getByRole('button', { name: 'اضافة اجازة', exact: true }).click()
await page.waitForTimeout(800)
const dlg = page.locator('[role=dialog]')
const selects = dlg.locator('select')
await selects.nth(0).selectOption({ index: 1 }) // employee
await selects.nth(1).selectOption({ index: 1 }) // leave type
const dates = dlg.locator('input[type=date]')
await dates.nth(0).fill('2026-10-01')
await dates.nth(1).fill('2026-10-02')
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1800)
console.log('  toast:', (await page.locator('[class*=toast]').allTextContents()).join(' | '))
report('add-leave')

// add-permission
await go('/hr?module=add-permission')
await page.getByRole('button', { name: 'اضافة اذن', exact: true }).click()
await page.waitForTimeout(800)
const dlg2 = page.locator('[role=dialog]')
await dlg2.locator('select').first().selectOption({ index: 1 })
await dlg2.locator('input[type=date]').fill('2026-10-01')
const times = dlg2.locator('input[type=time]')
if (await times.count() >= 2) { await times.nth(0).fill('09:00'); await times.nth(1).fill('10:00') }
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1800)
console.log('  toast:', (await page.locator('[class*=toast]').allTextContents()).join(' | '))
report('add-permission')

// users: اضافة مستخدم
await go('/team')
await page.getByRole('button', { name: 'اضافة مستخدم', exact: true }).click()
await page.waitForTimeout(800)
const dlg3 = page.locator('[role=dialog]')
const inputs3 = dlg3.locator('input')
const stamp = Date.now()
await inputs3.nth(0).fill(`e2e${stamp}@example.com`) // email
await inputs3.nth(1).fill('E2E') // first_name
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1800)
console.log('  toast:', (await page.locator('[class*=toast]').allTextContents()).join(' | '))
report('add-user')

// roles: اضافة صلاحية (retry now that perms are granted)
await go('/hr-managers')
await page.getByRole('button', { name: 'اضافة صلاحية', exact: true }).click()
await page.waitForTimeout(500)
await page.locator('[role=dialog] input').first().fill('Test Role ' + stamp)
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1800)
console.log('  toast:', (await page.locator('[class*=toast]').allTextContents()).join(' | '))
report('add-role')

// nationality retry
await go('/hr?module=nationality')
await page.getByRole('button', { name: 'اضافة جنسية', exact: true }).click()
await page.waitForTimeout(500)
await page.locator('[role=dialog] input').first().fill('بلد اختبار ' + stamp)
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1800)
console.log('  toast:', (await page.locator('[class*=toast]').allTextContents()).join(' | '))
report('add-nationality')

// branch retry (needs company now)
await go('/branches')
await page.getByRole('button', { name: 'اضافة فرع', exact: true }).click()
await page.waitForTimeout(500)
await page.locator('[role=dialog] input').first().fill('فرع اختبار ' + stamp)
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1800)
console.log('  toast:', (await page.locator('[class*=toast]').allTextContents()).join(' | '))
report('add-branch')

// holiday list retry (with dates)
await go('/hr?module=official-holidays')
await page.getByRole('button', { name: 'اضافة عطلة رسمية', exact: true }).click()
await page.waitForTimeout(500)
const dlg4 = page.locator('[role=dialog]')
await dlg4.locator('input:not([type=date])').first().fill('عطلة اختبار ' + stamp)
await dlg4.locator('input[type=date]').nth(0).fill('2026-10-01')
await dlg4.locator('input[type=date]').nth(1).fill('2026-10-02')
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1800)
console.log('  toast:', (await page.locator('[class*=toast]').allTextContents()).join(' | '))
report('add-holiday')

await browser.close()
