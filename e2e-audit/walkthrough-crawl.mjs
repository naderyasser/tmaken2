// Crawl every HR-shell surface of the login-free build and report what breaks.
// Usage: node e2e-audit/walkthrough-crawl.mjs [baseUrl] [shotsDir]
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'https://tamkeen-v2.base.meena.sa'
const SHOTS = process.argv[3] || 'e2e-audit/shots-walkthrough'
fs.mkdirSync(SHOTS, { recursive: true })

const PAGES = [
  '/hr', '/employees', '/hr?module=jobs', '/branches', '/shift-management',
  '/hr?module=unregistered-employees', '/hr?module=projects', '/hr?module=tasks',
  '/hr?module=location-groups', '/hr?module=employee-groups', '/hr?module=nationality',
  '/hr?module=official-holidays', '/hr?module=leave-types',
  '/hr?module=add-leave', '/hr?module=add-permission', '/attendance', '/hr?module=cancel-transactions',
  '/requests', '/hr?module=attendance-report',
  '/team', '/hr-managers', '/hr?module=user-transactions',
  '/hr?module=ramadan-schedule', '/hr?module=attendance-settings', 
  '/biometric', '/hr?module=settings', '/hr?module=requests-settings', '/hr?module=company-data',
  '/hr?module=subscription-info', '/hr?module=locations', '/employee/new', '/login', '/',
  ...['daystatus', 'detailed', 'total', 'vacations', 'delays', 'absences', 'late-early', 'total-absence', 'employees',
      'overtime', 'incomplete', 'permissions', 'by-branch', 'on-site', 'rejected-on-site'].map((s) => `/hr?module=report-${s}`),
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' })
const page = await ctx.newPage()
const report = []

for (const p of PAGES) {
  const errors = [], failed = []
  const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) }
  const onResp = (r) => { const s = r.status(); if (s >= 400 && !r.url().includes('/_next/')) failed.push(`${s} ${r.request().method()} ${r.url().slice(BASE.length, BASE.length + 140)}`) }
  page.on('console', onConsole); page.on('response', onResp)
  let finalUrl = '', title = '', text = ''
  try {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    finalUrl = page.url().replace(BASE, '')
    title = await page.title()
    text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)
    const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
  } catch (e) { errors.push('NAV: ' + e.message.slice(0, 200)) }
  page.off('console', onConsole); page.off('response', onResp)
  const flags = []
  if (/تسجيل الدخول|Login|Log in|كلمة المرور/.test(text)) flags.push('LOGIN-TEXT')
  if (/غير مصرح|Unauthorized/.test(text)) flags.push('UNAUTHORIZED')
  if (/قيد التطوير/.test(text)) flags.push('COMING-SOON')
  report.push({ page: p, finalUrl, title, flags, errors: [...new Set(errors)], failed: [...new Set(failed)], text })
}
await browser.close()
fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2))
for (const r of report) {
  const bad = r.flags.length || r.errors.length || r.failed.length
  console.log(`${bad ? '✗' : '✓'} ${r.page} → ${r.finalUrl} ${r.flags.join(',')}`)
  for (const f of r.failed) console.log('    ' + f)
  for (const e of r.errors) console.log('    console: ' + e)
}
