import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1456, height: 836 }, locale: 'ar' })).newPage()
await page.goto(BASE + '/hr', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: 'e2e-audit/apex/ours/hr_1456.png' })
await browser.close()
