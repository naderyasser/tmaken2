// Open a report, set a date range, search, screenshot the result table.
import { chromium } from '@playwright/test'
const [slug = 'daystatus', from = '2026-09-10', to = '2026-09-10'] = process.argv.slice(2)
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
await page.goto(`${BASE}/hr?module=report-${slug}`, { waitUntil: 'networkidle', timeout: 60000 })
const dates = page.locator('input[type=date]')
if (await dates.count() >= 2) { await dates.nth(0).fill(from); await dates.nth(1).fill(to) }
await page.getByRole('button', { name: 'بحث', exact: true }).click()
await page.waitForTimeout(6000)
await page.screenshot({ path: `e2e-audit/apex/ours/report_${slug}.png` })
console.log('rows:', await page.locator('tbody tr').count(), 'text:', (await page.locator('tbody').innerText()).slice(0, 200).replace(/\s+/g, ' '))
await browser.close()
