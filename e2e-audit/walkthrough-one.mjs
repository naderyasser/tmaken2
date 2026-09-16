import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const target = process.argv[2] || '/hr'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
page.on('response', (r) => { const s = r.status(); if (s >= 300 && !r.url().includes('/_next/')) console.log(s, r.request().method(), r.url().replace(BASE, '').slice(0, 120)) })
await page.goto(BASE + target, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)
console.log('final:', page.url().replace(BASE, ''))
console.log('launcher:', await page.locator('text=مساعد الأدمن').count(), 'login-text:', await page.locator('text=تسجيل الدخول').count())
await page.screenshot({ path: 'e2e-audit/one.png' })
await browser.close()
