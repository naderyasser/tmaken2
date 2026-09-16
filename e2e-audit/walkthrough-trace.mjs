// Trace the very first visit: every non-_next request in order with its status.
import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
page.on('response', (r) => { if (!r.url().includes('/_next/')) console.log(r.status(), r.request().method(), r.url().replace(BASE, '').slice(0, 110), r.request().headers()['cookie'] ? 'cookie' : 'NO-COOKIE') })
await page.goto(BASE + '/hr', { waitUntil: 'networkidle', timeout: 60000 })
console.log('final', page.url().replace(BASE, ''))
console.log('cookies', (await ctx.cookies()).map(c => c.name + '=' + c.value.slice(0, 8)).join(' '))
await browser.close()
