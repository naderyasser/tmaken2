import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
await page.goto(BASE + '/employee/new', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1200)
const selects = await page.locator('select').all()
for (const s of selects) {
  const label = await s.evaluate(el => el.closest('div')?.previousSibling?.textContent || el.parentElement?.previousElementSibling?.textContent || '?')
  const opts = await s.locator('option').allTextContents()
  console.log(label, '->', opts.slice(0, 4))
}
await browser.close()
