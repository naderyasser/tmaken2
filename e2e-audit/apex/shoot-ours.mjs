// Screenshot our pages (login-free walkthrough) for side-by-side checks with Apex.
// Usage: node e2e-audit/apex/shoot-ours.mjs [path ...]
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const BASE = 'https://tamkeen-v2.base.meena.sa'
const OUT = 'e2e-audit/apex/ours'
fs.mkdirSync(OUT, { recursive: true })
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/hr']
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1512, height: 812 }, locale: 'ar' })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) errors.push(`${r.status()} ${r.url().slice(BASE.length, BASE.length + 120)}`) })
for (const p of paths) {
  errors.length = 0
  await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(p, '→', page.url().replace(BASE, ''), errors.length ? '\n   ' + [...new Set(errors)].join('\n   ') : '✓')
}
await browser.close()
