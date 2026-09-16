// Exercise the write flows end-to-end against the live walkthrough session.
import { chromium } from '@playwright/test'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 900 }, locale: 'ar' })).newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE,'').slice(0,140)}`) })

async function go(p) { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(1000) }

// 1) add a job (generic list dialog)
await go('/hr?module=jobs')
await page.getByRole('button', { name: 'اضافة وظيفة' }).click()
await page.waitForTimeout(500)
await page.locator('input').first().fill('E2E Test Job ' + Date.now())
await page.getByRole('button', { name: 'حفظ', exact: true }).click()
await page.waitForTimeout(1500)
console.log('after add job errors:', errors.length ? errors.join(' | ') : 'none')

await browser.close()
