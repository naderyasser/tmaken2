import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
let errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE,'').slice(0,150)}`) })
async function go(p) { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1000) }
const stamp = Date.now()
const results = []

async function addAndVerify(label, modulePath, addLabel, fillFn, checkDt, checkFilter) {
  errors = []
  try {
    await go(modulePath)
    await page.getByRole('button', { name: addLabel, exact: true }).click()
    await page.waitForTimeout(600)
    await fillFn()
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await page.waitForTimeout(2000)
    const toast = (await page.locator('[class*=toast]').allTextContents()).join(' | ')
    results.push({ label, toast, httpErrors: [...new Set(errors)], checkDt, checkFilter })
  } catch (e) {
    results.push({ label, error: e.message.slice(0, 200) })
  }
}

await addAndVerify('branch', '/branches', 'اضافة فرع', async () => {
  await page.locator('[role=dialog] input').first().fill('فرع تجربة ' + stamp)
}, 'Branch', { branch: ['like', 'فرع تجربة%'] })

await addAndVerify('nationality', '/hr?module=nationality', 'اضافة جنسية', async () => {
  await page.locator('[role=dialog] input').first().fill('جنسية تجربة ' + stamp)
}, 'Country', { country_name: ['like', 'جنسية تجربة%'] })

await addAndVerify('employee-group', '/hr?module=employee-groups', 'إضافة مجموعة الموظفين', async () => {
  await page.locator('[role=dialog] input').first().fill('مجموعة تجربة ' + stamp)
}, 'Employee Group', { employee_group_name: ['like', 'مجموعة تجربة%'] })

await addAndVerify('leave-type', '/hr?module=leave-types', 'اضافة اجازة', async () => {
  await page.locator('[role=dialog] input').first().fill('اجازة تجربة ' + stamp)
}, 'Leave Type', { leave_type_name: ['like', 'اجازة تجربة%'] })

await addAndVerify('role', '/hr-managers', 'اضافة صلاحية', async () => {
  await page.locator('[role=dialog] input').first().fill('Test Role B ' + stamp)
}, 'Role', { role_name: ['like', 'Test Role B%'] })

await addAndVerify('permission', '/hr?module=add-permission', 'اضافة اذن', async () => {
  const dlg = page.locator('[role=dialog]')
  await dlg.locator('select').first().selectOption({ index: 1 })
  await dlg.locator('input[type=date]').fill('2026-10-05')
  const times = dlg.locator('input[type=time]')
  await times.nth(0).fill('09:00'); await times.nth(1).fill('10:00')
  await dlg.locator('textarea').fill('اختبار تلقائي')
}, 'Permission Request', { permission_date: '2026-10-05' })

errors = []
try {
  await go('/requests')
  await page.getByRole('button', { name: 'البصمات' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'اضافة طلب بصمة', exact: true }).click()
  await page.waitForTimeout(600)
  const dlg = page.locator('[role=dialog]')
  await dlg.locator('select').nth(0).selectOption({ index: 1 }) // employee
  await dlg.locator('input[type=date]').nth(0).fill('2026-10-06')
  await dlg.locator('input[type=date]').nth(1).fill('2026-10-06')
  await dlg.locator('select').nth(1).selectOption({ index: 1 }) // reason
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await page.waitForTimeout(2000)
  const toast = (await page.locator('[class*=toast]').allTextContents()).join(' | ')
  results.push({ label: 'fingerprint', toast, httpErrors: [...new Set(errors)], checkDt: 'Attendance Request', checkFilter: { from_date: '2026-10-06' } })
} catch (e) {
  results.push({ label: 'fingerprint', error: e.message.slice(0, 200) })
}

for (const r of results) console.log(JSON.stringify(r))
await browser.close()
