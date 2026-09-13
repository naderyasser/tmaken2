import { test as base, expect, type Page, type BrowserContext, type TestInfo } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Audit harness for the تمكين HR read-only prod audit.
 *
 *  - installMutationBlocker: network-layer guarantee of non-destructiveness.
 *    Write-shaped API calls are aborted and logged; read calls pass through.
 *  - AuditSession: per-test collectors (console / pageerror / HTTP failures),
 *    a settle() that outlasts spinners, and scan() — the cross-cutting checks
 *    (dates, localization leaks, icon-only buttons, money, RTL, empty states,
 *    pagination accuracy, a11y via axe) recorded as NDJSON findings.
 */

const REPORT_DIR = path.resolve(__dirname, '../report')
const FINDINGS = path.join(REPORT_DIR, 'findings.ndjson')
const MUTATIONS = path.join(REPORT_DIR, 'mutations-blocked.ndjson')

export type Status = 'pass' | 'fail' | 'warn'
export interface Finding {
  app: 'A' | 'B'
  screen: string
  path: string
  check: string
  status: Status
  details: string
}

export function record(f: Finding) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.appendFileSync(FINDINGS, JSON.stringify(f) + '\n')
}

// ── Mutation blocker ────────────────────────────────────────────────────────
// Read-only guarantee: block anything write-shaped. Frappe reads legitimately
// use POST (frappe.client.get_list, query_report.run, get_csrf_token…), so we
// block by VERB for PUT/DELETE/PATCH, and by NAME for POSTs whose target looks
// mutating. False-positive blocks degrade a widget, never the audit.
const WRITE_NAME =
  /(save|submit|_cancel|cancel_|delete|remove|create|insert|update|upload|approve|reject|assign|invite|provision|impersonate|logout|transfer|make_|add_|set_|mark_|toggle|enable_|disable_|send_|post_|write_|generate_password|reset_password|close_month|bulk_)/i

function decodeApiPath(url: URL): string {
  // The app proxies some calls as /api/frappe?path=<encoded frappe path>.
  if (url.pathname.startsWith('/api/frappe')) {
    const p = url.searchParams.get('path')
    if (p) {
      try {
        return decodeURIComponent(p)
      } catch {
        return p
      }
    }
  }
  return url.pathname
}

export async function installMutationBlocker(context: BrowserContext, label: string) {
  await context.route('**/*', (route) => {
    const req = route.request()
    const method = req.method()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return route.continue()

    let url: URL
    try {
      url = new URL(req.url())
    } catch {
      return route.continue()
    }
    const apiPath = decodeApiPath(url)
    const isApi = /\/api\//.test(url.pathname) || /\/api\//.test(apiPath)

    const blocked =
      (isApi && (method === 'PUT' || method === 'DELETE' || method === 'PATCH')) ||
      // POST /api/resource/<Doctype> == document creation
      (method === 'POST' && /\/api\/resource\/[^/?]+\/?$/.test(apiPath)) ||
      // POST to a write-shaped whitelisted method
      (method === 'POST' && isApi && WRITE_NAME.test(apiPath))

    if (blocked) {
      fs.appendFileSync(
        MUTATIONS,
        JSON.stringify({ ts: new Date().toISOString(), label, method, path: apiPath.slice(0, 180) }) + '\n',
      )
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
}

// ── Collectors ──────────────────────────────────────────────────────────────
const CONSOLE_IGNORE =
  /(ERR_BLOCKED_BY_CLIENT|ERR_ABORTED|favicon|Download the React DevTools|third-party cookie|Tracking Prevention)/i
const URL_IGNORE = /(favicon|\.well-known|hot-update|__nextjs|sentry|analytics)/i

export class AuditSession {
  page: Page
  testInfo: TestInfo
  consoleErrors: string[] = []
  pageErrors: string[] = []
  badResponses: string[] = []
  failedRequests: string[] = []
  private host: string

  constructor(page: Page, testInfo: TestInfo) {
    this.page = page
    this.testInfo = testInfo
    const base = (testInfo.project.use.baseURL as string) || 'https://qarawi.base.meena.sa'
    this.host = new URL(base).host

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (CONSOLE_IGNORE.test(text)) return
      this.consoleErrors.push(text.slice(0, 220))
    })
    page.on('pageerror', (err) => this.pageErrors.push(String(err?.message || err).slice(0, 220)))
    page.on('response', (res) => {
      const status = res.status()
      if (status < 400) return
      const u = res.url()
      if (!u.includes(this.host) || URL_IGNORE.test(u)) return
      this.badResponses.push(`${status} ${u.replace(`https://${this.host}`, '').slice(0, 160)}`)
    })
    page.on('requestfailed', (req) => {
      const f = req.failure()?.errorText || ''
      if (/ERR_ABORTED|BLOCKED_BY_CLIENT/i.test(f)) return
      const u = req.url()
      if (!u.includes(this.host) || URL_IGNORE.test(u)) return
      this.failedRequests.push(`${f} ${u.replace(`https://${this.host}`, '').slice(0, 140)}`)
    })
  }

  resetNetLog() {
    this.consoleErrors = []
    this.pageErrors = []
    this.badResponses = []
    this.failedRequests = []
  }

  async visit(p: string) {
    await this.page.goto(p, { waitUntil: 'domcontentloaded' })
    await this.settle()
  }

  async settle() {
    await this.page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {})
    // Outwait spinners (bounded) — records nothing here; scan() re-checks.
    const t0 = Date.now()
    while (Date.now() - t0 < 8000) {
      const spinning = await this.page
        .locator('[class*="animate-spin"]:visible')
        .count()
        .catch(() => 0)
      if (spinning === 0) break
      await this.page.waitForTimeout(400)
    }
    await this.page.waitForTimeout(400)
  }

  // ── The in-page cross-cutting scanner ────────────────────────────────────
  async pageScan() {
    return this.page.evaluate(() => {
      const vis = (el: Element | null): boolean => {
        if (!el || !(el as HTMLElement).getBoundingClientRect) return false
        const he = el as HTMLElement
        if (he.closest('script,style,noscript,template')) return false
        const r = he.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return false
        const cs = getComputedStyle(he)
        return cs.visibility !== 'hidden' && cs.display !== 'none'
      }
      const trunc = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + '…' : s)

      // Gather visible text nodes with parent references.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const nodes: { text: string; el: Element }[] = []
      let n: Node | null
      while ((n = walker.nextNode())) {
        const t = (n.textContent || '').trim()
        if (!t || t.length < 2) continue
        const el = n.parentElement
        if (!el || !vis(el)) continue
        nodes.push({ text: t, el })
      }
      const fullText = nodes.map((x) => x.text).join(' \n ')

      // Dates
      const isoDates: string[] = []
      const usDates: string[] = []
      const hijri: string[] = []
      let canonical = 0
      const isoRe = /\b\d{4}-\d{2}-\d{2}\b/
      const slashRe = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g
      const yFirstRe = /\b\d{4}\/\d{1,2}\/\d{1,2}\b/
      const hijriRe = /\b[\d٠-٩]{1,2}\/[\d٠-٩]{1,2}\/[\d٠-٩]{4}\s*هـ|\b[\d٠-٩]{4}\/[\d٠-٩]{1,2}\/[\d٠-٩]{1,2}\s*هـ|[\d٠-٩]\s*هـ\b/
      for (const { text } of nodes) {
        if (isoRe.test(text)) isoDates.push(trunc(text))
        if (yFirstRe.test(text)) usDates.push('yyyy/m/d: ' + trunc(text))
        let m: RegExpExecArray | null
        slashRe.lastIndex = 0
        while ((m = slashRe.exec(text))) {
          const [_, a, b] = m
          if (a.length === 2 && b.length === 2) canonical++
          else usDates.push(trunc(text))
        }
        if (hijriRe.test(text)) hijri.push(trunc(text))
      }

      // Arabic-Indic digits (app standard = Latin numerals)
      const arabicIndic = nodes.filter((x) => /[٠-٩]/.test(x.text)).map((x) => trunc(x.text)).slice(0, 4)

      // Localization leaks — known English enums in the Arabic UI
      const ENUMS = [
        'Active', 'Inactive', 'Suspended', 'Left', 'Open', 'Closed', 'Cancelled', 'Draft',
        'Submitted', 'Pending', 'Approved', 'Rejected', 'Present', 'Absent', 'Half Day', 'On Leave',
        'HR Manager', 'HR User', 'Chief Executive Officer', 'Engineer', 'Accountant', 'Supervisor',
        'Earning', 'Deduction', 'Male', 'Female', 'Paid', 'Unpaid',
      ]
      const leaks: string[] = []
      for (const { text } of nodes) {
        for (const e of ENUMS) {
          const re = new RegExp(`(?:^|[^\\w])${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^\\w]|$)`)
          if (re.test(text)) {
            leaks.push(`${e} ← "${trunc(text, 60)}"`)
            break
          }
        }
        if (leaks.length >= 8) break
      }

      // Raw i18n keys (dotted keys leaking)
      const rawKeys: string[] = []
      const keyRe = /(?<![\w@./-])[a-z][a-z0-9]{1,}\.[a-z_]{2,}(?:\.[a-z_]{2,})*(?![\w@])/g
      const KEY_DENY = /\.(com|sa|net|org|io|js|ts|css|png|jpe?g|svg|json|pdf|xlsx?|local)\b|@|^www\./i
      for (const { text } of nodes) {
        let m: RegExpExecArray | null
        keyRe.lastIndex = 0
        while ((m = keyRe.exec(text))) {
          if (!KEY_DENY.test(m[0])) rawKeys.push(m[0])
        }
        if (rawKeys.length >= 6) break
      }

      // Icon-only actionable elements without accessible name
      const iconBtns: string[] = []
      let iconBtnCount = 0
      document.querySelectorAll('button, [role="button"], a[href]').forEach((b) => {
        if (!vis(b)) return
        const he = b as HTMLElement
        const text = (he.innerText || '').trim()
        if (text) return
        if (he.getAttribute('aria-label') || he.getAttribute('title')) return
        if (!he.querySelector('svg')) return
        iconBtnCount++
        if (iconBtns.length < 4) {
          const ctx = he.closest('td,th') ? 'table-action' : he.closest('header') ? 'header' : 'page'
          iconBtns.push(`${ctx}: ${trunc(he.outerHTML.replace(/\s+/g, ' '), 110)}`)
        }
      })

      // Money: bare big integers inside table cells (no separators / unit)
      const money: string[] = []
      document.querySelectorAll('td, [role="cell"]').forEach((cell) => {
        if (!vis(cell)) return
        const t = (cell.textContent || '').trim()
        if (!t || t.length > 40) return
        if (/[,٬]|ر\.س|﷼|SAR/.test(t)) return
        if (/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|هـ/.test(t)) return
        if (/^[A-Z]{2,}[-\d]/.test(t) || /^05\d{8}$/.test(t)) return
        const m = t.match(/(?<![\d.,/-])\d{5,}(?![\d.,/%-])/)
        if (m && money.length < 6) money.push(`${m[0]} ← "${trunc(t, 40)}"`)
      })

      // Empty states: message with/without a CTA nearby
      const emptyStates: { text: string; hasCta: boolean }[] = []
      nodes.forEach(({ text, el }) => {
        if (!/^(لا (توجد|يوجد))/.test(text) || text.length > 90) return
        let scope: Element | null = el
        for (let i = 0; i < 4 && scope; i++) scope = scope.parentElement
        const hasCta = !!scope?.querySelector('button, a[href]')
        if (emptyStates.length < 4) emptyStates.push({ text: trunc(text, 70), hasCta })
      })

      // Pagination accuracy: "عرض X من Y"
      let pagination: { shown: number; total: number; visibleRows: number } | null = null
      const pm = fullText.match(/عرض\s*(\d+)\s*من(?:\s*أصل)?\s*(\d+)/)
      if (pm) {
        let visibleRows = 0
        document.querySelectorAll('table tbody').forEach((tb) => {
          if (!vis(tb)) return
          const rows = Array.from(tb.querySelectorAll(':scope > tr')).filter(vis).length
          visibleRows = Math.max(visibleRows, rows)
        })
        pagination = { shown: parseInt(pm[1], 10), total: parseInt(pm[2], 10), visibleRows }
      }

      // Structure / RTL / spinners
      const h = document.querySelector('h1, h2')
      const header = !!(h && vis(h) && (h.textContent || '').trim())
      const dir = document.documentElement.getAttribute('dir') || ''
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 8
      const spinners = Array.from(document.querySelectorAll('[class*="animate-spin"]')).filter(vis).length

      return {
        textLen: fullText.length,
        isoDates: isoDates.slice(0, 5),
        usDates: usDates.slice(0, 5),
        hijri: hijri.slice(0, 4),
        canonical,
        arabicIndic,
        leaks,
        rawKeys: Array.from(new Set(rawKeys)).slice(0, 5),
        iconBtnCount,
        iconBtns,
        money,
        emptyStates,
        pagination,
        header,
        dir,
        overflow,
        spinners,
      }
    })
  }

  // ── Full scan + grading + NDJSON ─────────────────────────────────────────
  async scan(opts: {
    app: 'A' | 'B'
    screen: string
    path: string
    moneyScan?: boolean
    axe?: boolean
    lightweight?: boolean
  }) {
    const { app, screen } = opts
    const p = opts.path
    const s = await this.pageScan()
    const F: Finding[] = []
    const add = (check: string, status: Status, details: string) =>
      F.push({ app, screen, path: p, check, status, details })

    // Hard load-quality checks
    if (!opts.lightweight) {
      if (this.pageErrors.length) add('js-exceptions', 'fail', this.pageErrors.slice(0, 3).join(' | '))
      if (this.consoleErrors.length) add('console-errors', 'fail', this.consoleErrors.slice(0, 3).join(' | '))
      else add('console-errors', 'pass', 'no console errors')
      if (this.badResponses.length) add('http-failures', 'fail', this.badResponses.slice(0, 4).join(' | '))
      else add('http-failures', 'pass', 'no 4xx/5xx')
      if (this.failedRequests.length) add('network-failed', 'warn', this.failedRequests.slice(0, 3).join(' | '))
      if (s.textLen < 40) add('blank-page', 'fail', `visible text length=${s.textLen}`)
      if (s.spinners > 0) add('stuck-spinner', 'warn', `${s.spinners} spinner(s) still visible after settle`)
      add('rtl-dir', s.dir === 'rtl' ? 'pass' : 'warn', `html[dir="${s.dir}"]`)
      if (s.overflow) add('rtl-overflow', 'warn', 'horizontal overflow on documentElement')
      add('page-header', s.header ? 'pass' : 'warn', s.header ? 'h1/h2 present' : 'no visible h1/h2 title')
    }

    // Cross-cutting content checks
    if (s.isoDates.length) add('date-format', 'warn', `ISO yyyy-mm-dd: ${s.isoDates.join(' · ')}`)
    if (s.usDates.length) add('date-format', 'warn', `non-canonical m/d/yyyy: ${s.usDates.join(' · ')}`)
    if (s.hijri.length && s.canonical === 0 && (s.isoDates.length || s.usDates.length || s.hijri.length))
      add('date-format', 'warn', `Hijri without Gregorian primary: ${s.hijri.join(' · ')}`)
    if (!s.isoDates.length && !s.usDates.length && s.canonical > 0)
      add('date-format', 'pass', `${s.canonical} canonical dd/mm/yyyy date(s)`)
    if (s.arabicIndic.length) add('numerals', 'warn', `Arabic-Indic digits (app standard is Latin): ${s.arabicIndic.join(' · ')}`)
    if (s.leaks.length) add('i18n-leak', 'warn', s.leaks.slice(0, 6).join(' | '))
    else add('i18n-leak', 'pass', 'no known English enum leaked')
    if (s.rawKeys.length) add('i18n-raw-key', 'warn', s.rawKeys.join(' · '))
    if (s.iconBtnCount) add('icon-buttons-unlabeled', 'warn', `${s.iconBtnCount} icon-only control(s) without aria-label/title — e.g. ${s.iconBtns[0] || ''}`)
    else add('icon-buttons-unlabeled', 'pass', 'all icon controls labeled')
    if (opts.moneyScan) {
      if (s.money.length) add('money-format', 'warn', `raw amounts without separators/currency: ${s.money.join(' · ')}`)
      else add('money-format', 'pass', 'no raw unformatted amounts detected')
    }
    for (const e of s.emptyStates) {
      add('empty-state-cta', e.hasCta ? 'pass' : 'warn', `"${e.text}" ${e.hasCta ? 'has' : 'has NO'} CTA`)
    }
    if (s.pagination) {
      const { shown, total, visibleRows } = s.pagination
      const ok = visibleRows === 0 || Math.abs(visibleRows - shown) <= 1
      add('pagination-accuracy', ok ? 'pass' : 'warn', `عرض ${shown} من ${total} vs ${visibleRows} visible rows`)
    }

    // Accessibility (axe) — once per page, not per tab
    if (opts.axe) {
      try {
        const { AxeBuilder } = await import('@axe-core/playwright')
        const res = await new AxeBuilder({ page: this.page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        const bad = res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
        if (!bad.length) add('a11y-axe', 'pass', 'no critical/serious violations')
        for (const v of bad.slice(0, 6)) {
          add('a11y-axe', v.impact === 'critical' ? 'fail' : 'warn', `${v.id} ×${v.nodes.length} — ${v.help}`)
        }
      } catch (e: any) {
        add('a11y-axe', 'warn', `axe failed to run: ${String(e?.message || e).slice(0, 120)}`)
      }
    }

    F.forEach(record)
    const hard = F.filter((f) => f.status === 'fail')
    return { findings: F, hard, scanRaw: s }
  }

  /** Walk visible tabs (shadcn Tabs and SegmentedControl) and light-scan each. */
  async walkTabs(opts: { app: 'A' | 'B'; screen: string; path: string; moneyScan?: boolean }) {
    const tabs = this.page.locator('[role="tab"]:visible, button[aria-selected]:visible')
    const count = Math.min(await tabs.count().catch(() => 0), 10)
    if (count < 2) return
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i)
      const name = ((await tab.innerText().catch(() => '')) || `tab-${i}`).replace(/\s+/g, ' ').trim().slice(0, 30)
      try {
        await tab.click({ timeout: 4000 })
      } catch {
        continue
      }
      await this.page.waitForTimeout(900)
      await this.settle()
      await this.scan({
        app: opts.app,
        screen: `${opts.screen} › ${name}`,
        path: opts.path,
        moneyScan: opts.moneyScan,
        lightweight: true,
      })
    }
  }

  /** Generic in-content search probe: type nonsense, expect the list to react, clear. */
  async searchProbe(opts: { app: 'A' | 'B'; screen: string; path: string }) {
    const inputs = this.page.locator('input[placeholder*="بحث"]:visible')
    const n = await inputs.count().catch(() => 0)
    let target = null as null | ReturnType<typeof inputs.nth>
    for (let i = 0; i < n; i++) {
      const box = await inputs.nth(i).boundingBox().catch(() => null)
      if (box && box.y > 110) {
        target = inputs.nth(i)
        break
      }
    }
    if (!target) return
    const before = await this.page.locator('table tbody tr:visible').count().catch(() => 0)
    await target.fill('زايتلا-احتمال-صفر-٩٩').catch(() => {})
    await this.page.waitForTimeout(900)
    const after = await this.page.locator('table tbody tr:visible').count().catch(() => 0)
    const emptyShown = await this.page.locator('text=/لا (توجد|يوجد)/').first().isVisible().catch(() => false)
    const reacted = after !== before || emptyShown
    record({
      app: opts.app,
      screen: opts.screen,
      path: opts.path,
      check: 'search-interactive',
      status: reacted ? 'pass' : 'warn',
      details: reacted ? `rows ${before}→${after}${emptyShown ? ' (empty state shown)' : ''}` : 'list did not react to search input',
    })
    await target.fill('').catch(() => {})
    await this.page.waitForTimeout(500)
  }
}

export const test = base.extend<{ audit: AuditSession }>({
  context: async ({ context }, use, testInfo) => {
    await installMutationBlocker(context, testInfo.title)
    await use(context)
  },
  audit: async ({ page }, use, testInfo) => {
    const a = new AuditSession(page, testInfo)
    await use(a)
  },
})

export { expect }
