import { chromium } from '@playwright/test'
const browser = await chromium.launch()
for (const w of [390, 768, 1024, 1280, 1366]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ar' })).newPage()
  await page.goto('https://tamkeen-v2.base.meena.sa/hr', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `e2e-audit/apex/ours/width-${w}.png` })
  const asideCount = await page.locator('aside').count()
  const visible = await page.evaluate(() => [...document.querySelectorAll('aside')].map(a => getComputedStyle(a).display))
  console.log(w, 'asides:', asideCount, visible)
  await page.close()
}
await browser.close()
