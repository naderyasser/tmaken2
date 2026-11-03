// Role-guard tests against alhkm using the two QA users' storage states.
//   node e2e-audit/role-tests.mjs
// Expects .auth/state.<name>.json files built by the runner (sid cookies).
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'https://alhkm.base.meena.sa'
const out = []

async function surface(page, url) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const text = await page.evaluate(() => document.body.innerText.slice(0, 4000))
  return {
    url: page.url(),
    blocked: /غير مصرح|Unauthorized|تسجيل الدخول مطلوب|ليس لديك صلاحية/.test(text),
    hrShell: /الموظفون|لوحة التحكم|الموارد البشرية/.test(text),
    selfService: /يومك سعيد|طلب جديد|أرصدة الإجازات/.test(text),
    login: /كلمة المرور|تسجيل الدخول/.test(text) && /password|كلمة المرور/i.test(text),
  }
}

const b = await chromium.launch({ chromiumSandbox: false })
for (const [name, file] of [
  ['probe-noHR', '.auth/state.probe.json'],
  ['hr-manager', '.auth/state.p3.json'],
]) {
  const ctx = await b.newContext({ storageState: path.join(here, file), locale: 'ar', viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  for (const u of ['/hr', '/employee/new', '/me']) {
    const r = await surface(page, u)
    out.push({ user: name, path: u, ...r })
  }
  await ctx.close()
}
await b.close()
for (const r of out) {
  console.log(
    `${r.user.padEnd(11)} ${r.path.padEnd(14)} → final=${r.url.replace(BASE, '') || '/'} blocked=${r.blocked} hrShell=${r.hrShell} self=${r.selfService} loginPage=${r.login}`,
  )
}
fs.writeFileSync(path.join(here, 'report/role-tests.json'), JSON.stringify(out, null, 2))
