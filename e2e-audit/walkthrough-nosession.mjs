// Without a provisioned walkthrough account: /hr must bounce once, then show the
// "not enabled" screen — never loop, never show a login form.
import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const nav = []
page.on('request', (r) => { if (r.isNavigationRequest()) nav.push(r.url().replace(BASE, '')) })
await page.goto(BASE + '/hr', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
console.log('navigations:', nav.length, nav.slice(0, 8))
console.log('final url:', page.url().replace(BASE, ''))
console.log('text:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300))
await page.screenshot({ path: 'e2e-audit/nosession.png' })
await browser.close()
