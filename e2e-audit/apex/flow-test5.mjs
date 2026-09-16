import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
let errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE,'').slice(0,150)}`) })
async function go(p) { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1200) }
const report = (label) => { console.log(label, errors.length ? '\n   ' + [...new Set(errors)].join('\n   ') : '✓'); errors = [] }

async function simpleAdd(modulePath, addLabel, firstInputText) {
  await go(modulePath)
  await page.getByRole('button', { name: addLabel, exact: true }).click()
  await page.waitForTimeout(500)
  const dialog = page.locator('[role=dialog]')
  const firstInput = dialog.locator('input:not([type=checkbox])').first()
  if (await firstInput.count()) await firstInput.fill(firstInputText)
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await page.waitForTimeout(1800)
  const toast = await page.locator('[class*=toast], [role=status]').allTextContents().catch(() => [])
  console.log('  toast:', toast.join(' | '))
}

await simpleAdd('/hr?module=nationality', 'اضافة جنسية', 'بلد اختبار ' + Date.now())
report('nationality')

await simpleAdd('/hr?module=official-holidays', 'اضافة عطلة رسمية', 'عطلة اختبار ' + Date.now())
report('official-holidays')

await simpleAdd('/hr?module=leave-types', 'اضافة اجازة', 'اجازة اختبار ' + Date.now())
report('leave-types')

await simpleAdd('/hr?module=employee-groups', 'إضافة مجموعة الموظفين', 'مجموعة اختبار ' + Date.now())
report('employee-groups')

await simpleAdd('/hr?module=location-groups', 'اضافة مجموعة المواقع', 'مجموعة مواقع ' + Date.now())
report('location-groups')

await simpleAdd('/branches', 'اضافة فرع', 'فرع اختبار ' + Date.now())
report('branches')

await simpleAdd('/shift-management', 'إضافة دوام', 'دوام اختبار ' + Date.now())
report('shift-management')

await simpleAdd('/biometric', 'اضافة', 'DEV-' + Date.now())
report('biometric-device')

await simpleAdd('/hr?module=locations', 'اضافة موقع', 'موقع اختبار ' + Date.now())
report('locations')

await simpleAdd('/hr-managers', 'اضافة صلاحية', 'Test Role ' + Date.now())
report('roles')

await browser.close()
