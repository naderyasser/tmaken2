#!/usr/bin/env node
// Playwright driver for the base-meena-frontend web app (تمكين العقارية storefront + admin dashboard).
// Drives the ALREADY-RUNNING app with headless chromium and writes screenshots to ./shots/.
// Playwright is the project's own e2e dep — no extra install.
//
//   node driver.mjs                  # smoke: screenshot the storefront's key pages
//   node driver.mjs <url> [out.png]  # screenshot one arbitrary URL
//
// Prereq: the app is up — `systemctl is-active base-meena-frontend.service` (Next :3000) and
// `supervisorctl status frappe-dev-web` (Frappe API). See SKILL.md for starting them.
//
// HOSTS (this matters — see SKILL.md Gotchas):
//   Storefront  → http://localhost:8080            (marketplace mode; / , /search , /contracts …)
//   Dashboard   → https://qarawi.base.meena.sa/real-estate  (the :8080 host rewrites /real-estate away)

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
mkdirSync(SHOTS, { recursive: true })

const STORE = process.env.STORE_URL || 'http://localhost:8080'

// Key storefront surfaces, each with a sentinel string that must appear if the page rendered.
const PAGES = [
  { url: `${STORE}/`, out: 'storefront-home.png', expect: 'تمكين' },
  { url: `${STORE}/search`, out: 'storefront-search.png', expect: 'aqar-' },
  { url: `${STORE}/contracts`, out: 'storefront-contracts.png', expect: 'إدارة العقود' },
]

async function shoot(browser, url, out, expectText) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })
  let status = 0, found = ''
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    status = resp?.status() ?? 0
    const file = join(SHOTS, out)
    await page.screenshot({ path: file })
    if (expectText) found = (await page.content()).includes(expectText) ? 'ok' : 'MISSING'
    console.log(`[${status}] ${url}\n        -> ${file}${expectText ? `   sentinel "${expectText}": ${found}` : ''}`)
  } finally {
    await page.close()
  }
  return status === 200 && found !== 'MISSING'
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
let allOk = true
try {
  const [url, out] = process.argv.slice(2)
  if (url) {
    allOk = await shoot(browser, url, out || 'shot.png')
  } else {
    for (const p of PAGES) allOk = (await shoot(browser, p.url, p.out, p.expect)) && allOk
  }
} finally {
  await browser.close()
}
console.log(allOk ? '\nSMOKE: PASS' : '\nSMOKE: FAIL')
process.exit(allOk ? 0 : 1)
