// Probe the Apex ERP reference login page: form fields + screenshot.
// Reference system we are matching (Nader, 2026-09-16). Read-only.
import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar' })
const page = await ctx.newPage()
await page.goto('https://login.erp-apex.com/login', { waitUntil: 'networkidle', timeout: 60000 })
console.log('url', page.url(), '| title', await page.title())
const fields = await page.$$eval('input, select, button', (els) =>
  els.map((e) => ({ tag: e.tagName, type: e.type, name: e.name, id: e.id, ph: e.placeholder, text: (e.innerText || '').trim().slice(0, 40) })),
)
console.log(JSON.stringify(fields))
await page.screenshot({ path: 'e2e-audit/apex/00-login.png' })
await browser.close()
