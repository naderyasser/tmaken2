// Test edit + delete on a throwaway record (not add-only, as the earlier suite covered).
import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
const stamp = Date.now()
let errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '').slice(0, 150)}`) })
async function go(p) { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1000) }
const results = []
async function run(label, fn) {
  errors = []
  try { await fn(); results.push({ label, ok: !errors.length, errors: [...new Set(errors)] }) }
  catch (e) { results.push({ label, ok: false, error: e.message.slice(0, 200) }) }
}

// add → edit → delete a job (round-trip)
await run('job-lifecycle', async () => {
  await go('/hr?module=jobs')
  await page.getByRole('button', { name: 'اضافة وظيفة', exact: true }).click()
  await page.waitForTimeout(500)
  await page.locator('[role=dialog] input').first().fill('دورة حياة ' + stamp)
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await page.waitForTimeout(1500)
  // find the row, click edit (pencil), change name, save
  const row = page.locator('tr', { hasText: 'دورة حياة ' + stamp })
  await row.locator('button[title="تعديل"]').click()
  await page.waitForTimeout(500)
  await page.locator('[role=dialog] input').first().fill('دورة حياة معدّلة ' + stamp)
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await page.waitForTimeout(1500)
  const editedRow = page.locator('tr', { hasText: 'دورة حياة معدّلة ' + stamp })
  const stillThere = await editedRow.count()
  if (!stillThere) throw new Error('edit did not persist / row not found after edit')
  // delete
  await editedRow.locator('button[title="حذف"]').click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'حذف', exact: true }).last().click()
  await page.waitForTimeout(1500)
  const afterDelete = await page.locator('tr', { hasText: 'دورة حياة معدّلة ' + stamp }).count()
  if (afterDelete) throw new Error('delete did not remove the row')
})

// pagination + search on a real list
await run('employees-search-paginate', async () => {
  await go('/employees')
  await page.locator('input[placeholder="ابحث باسم او كود الموظف"]').fill('bilal')
  await page.waitForTimeout(1000)
  const rows = await page.locator('tbody tr').count()
  if (rows === 0) throw new Error('search returned nothing for a known employee')
  await page.locator('input[placeholder="ابحث باسم او كود الموظف"]').fill('')
  await page.waitForTimeout(800)
  const pager = page.getByRole('button', { name: '2', exact: true })
  if (await pager.count()) { await pager.click(); await page.waitForTimeout(800) }
})

// bulk actions menu (تنشيط/إلغاء التنشيط/حذف)
await run('bulk-actions-menu', async () => {
  await go('/hr?module=unregistered-employees')
  const firstCheckbox = page.locator('tbody tr input[type=checkbox]').first()
  if (await firstCheckbox.count()) {
    await firstCheckbox.check()
    await page.getByRole('button', { name: 'الاجراءات' }).click()
    await page.waitForTimeout(500)
    const menuVisible = await page.getByText('تنشيط', { exact: true }).count()
    if (!menuVisible) throw new Error('actions menu did not open')
    await page.keyboard.press('Escape')
  }
})

for (const r of results) console.log(JSON.stringify(r))
await browser.close()
