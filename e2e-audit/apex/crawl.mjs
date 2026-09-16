// Read-only crawl of the Apex ERP reference (the system tamkeen-v2 must match).
// Logs in with the credentials in e2e-audit/apex/.creds (git-ignored), walks
// every sidebar link, and writes per-page screenshots + a structural digest
// (headings, table columns, form labels, buttons, tabs) to apex/pages/.
//
// Hard read-only guard: every non-GET request except the login POST is aborted.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'e2e-audit/apex/pages'
fs.mkdirSync(OUT, { recursive: true })
const creds = Object.fromEntries(
  fs.readFileSync('e2e-audit/apex/.creds', 'utf8').split('\n').filter(Boolean).map((l) => l.split('=')),
)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar' })
await ctx.route('**/*', (route) => {
  const req = route.request()
  const m = req.method()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue()
  if (m === 'POST' && /login|auth|token|session|graphql|search|filter|list|get|fetch|query|paginate|datatable/i.test(req.url())) return route.continue()
  console.log('BLOCKED', m, req.url().slice(0, 120))
  return route.abort()
})
const page = await ctx.newPage()
page.on('request', (r) => { if (!/\.(js|css|png|jpg|svg|woff2?|ico)(\?|$)/.test(r.url())) console.log('REQ', r.method(), r.url().slice(0, 140), r.method() === 'POST' ? (r.postData() || '').slice(0, 200).replace(/Office_1406/g, '***') : '') })
page.on('response', (r) => { if (!/\.(js|css|png|jpg|svg|woff2?|ico)(\?|$)/.test(r.url())) console.log('RES', r.status(), r.url().slice(0, 140)) })
const apiCalls = new Set()
page.on('response', (r) => {
  const u = r.url()
  if (/\/api\/|\.json|graphql/i.test(u) && !/\.(js|css|png|svg|woff)/.test(u)) apiCalls.add(`${r.request().method()} ${r.status()} ${u.slice(0, 160)}`)
})

// ── login ────────────────────────────────────────────────────────────────────
await page.goto('https://login.erp-apex.com/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.fill('#companyName', creds.APEX_DB)
await page.fill('#email', creds.APEX_USER)
await page.fill('#password', creds.APEX_PASS)
await page.screenshot({ path: path.join(OUT, '00-filled.png') })
const submit = page.getByRole('button', { name: 'تسجيل الدخول' })
if (await submit.count()) await submit.first().click({ timeout: 10000 }).catch(async () => page.press('#password', 'Enter'))
else await page.press('#password', 'Enter')
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3000)
console.log('after login:', page.url(), '|', await page.title())
await page.screenshot({ path: path.join(OUT, '01-landing.png'), fullPage: true })
fs.writeFileSync(path.join(OUT, '01-landing.html'), await page.content())

// ── discover navigation ─────────────────────────────────────────────────────
const origin = new URL(page.url()).origin
const navLinks = await page.$$eval('a[href]', (as) =>
  as.map((a) => ({ href: a.getAttribute('href'), text: (a.innerText || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim(), inNav: !!a.closest('nav, aside, [class*=sidebar], [class*=side-nav], [class*=menu]') })),
)
fs.writeFileSync(path.join(OUT, 'links.json'), JSON.stringify(navLinks, null, 1))
const seen = new Set()
const targets = []
for (const l of navLinks) {
  if (!l.href || l.href.startsWith('#') || l.href.startsWith('javascript') || /logout|signout/i.test(l.href)) continue
  const abs = new URL(l.href, page.url()).toString()
  if (!abs.startsWith(origin)) continue
  const key = abs.replace(/[?#].*$/, '')
  if (seen.has(key)) continue
  seen.add(key)
  targets.push({ url: abs, text: l.text, inNav: l.inNav })
}
console.log('nav links:', targets.length)

// ── visit every page ────────────────────────────────────────────────────────
const digest = []
let i = 1
for (const t of targets) {
  i++
  const slug = String(i).padStart(2, '0') + '-' + (new URL(t.url).pathname.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root')
  const errors = []
  const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) }
  page.on('console', onConsole)
  try {
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    const info = await page.evaluate(() => {
      const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
      const uniq = (arr) => [...new Set(arr.filter(Boolean))]
      return {
        title: document.title,
        headings: uniq([...document.querySelectorAll('h1,h2,h3,.page-title,[class*=title]')].map(txt).filter((s) => s && s.length < 80)).slice(0, 25),
        breadcrumb: txt(document.querySelector('.breadcrumb, [class*=breadcrumb], nav[aria-label=breadcrumb]')),
        tableHeaders: [...document.querySelectorAll('table')].map((tb) => [...tb.querySelectorAll('thead th, thead td')].map(txt).filter(Boolean)).filter((h) => h.length),
        rowCount: [...document.querySelectorAll('table tbody')].map((b) => b.querySelectorAll('tr').length),
        labels: uniq([...document.querySelectorAll('label')].map(txt)).slice(0, 80),
        inputs: [...document.querySelectorAll('input,select,textarea')].map((e) => ({ t: e.tagName.toLowerCase(), type: e.type, name: e.name || e.id, ph: e.placeholder })).filter((x) => x.type !== 'hidden').slice(0, 80),
        buttons: uniq([...document.querySelectorAll('button, a.btn, [role=button], input[type=submit]')].map(txt)).filter((s) => s.length < 40).slice(0, 60),
        tabs: uniq([...document.querySelectorAll('[role=tab], .nav-tabs a, .tabs a, [class*=tab] a, [class*=tab] button')].map(txt)).slice(0, 30),
        cards: uniq([...document.querySelectorAll('.card-title, .card-header, [class*=card] h5, [class*=card] h6, [class*=stat] , [class*=widget] h5')].map(txt)).filter((s) => s && s.length < 60).slice(0, 40),
        sidebarText: txt(document.querySelector('aside, nav, [class*=sidebar]')).slice(0, 1500),
        bodyText: txt(document.body).slice(0, 2500),
      }
    })
    await page.screenshot({ path: path.join(OUT, slug + '.png'), fullPage: true })
    digest.push({ slug, nav: t.text, url: t.url.replace(origin, ''), finalUrl: page.url().replace(origin, ''), errors, ...info })
    console.log('✓', slug, '|', t.text, '|', info.title)
  } catch (e) {
    digest.push({ slug, nav: t.text, url: t.url.replace(origin, ''), error: e.message.slice(0, 200) })
    console.log('✗', slug, '|', t.text, '|', e.message.slice(0, 120))
  }
  page.off('console', onConsole)
}
fs.writeFileSync(path.join(OUT, 'digest.json'), JSON.stringify(digest, null, 1))
fs.writeFileSync(path.join(OUT, 'api-calls.txt'), [...apiCalls].sort().join('\n'))
await browser.close()
console.log('done:', digest.length, 'pages →', OUT)
