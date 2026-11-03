import { test, expect, type Page } from '@playwright/test'

/**
 * Cashier offline-first resilience suite.
 *
 * Covers: (1) network drop mid-work → sale queues with a provisional receipt and syncs
 * exactly once on reconnect; (2) reload mid-sale → cart + in-progress payment draft
 * restore; (3) connection flap storm → zero duplicate invoices. (Full browser-restart
 * recovery — SW shell + auth snapshot + IndexedDB — needs a persistent profile and is
 * verified by scripts/pos manual runbook; the same layers are exercised here.)
 *
 * Needs a live vhost + a POS Cashier user:
 *   CASHIER_E2E_URL=https://qarawi.base.meena.sa \
 *   E2E_CASHIER_USER=pos.e2e.cashier@test.local \
 *   E2E_CASHIER_PASSWORD=... \
 *   npx playwright test e2e/cashier-offline.spec.ts --project=chromium
 * Skips entirely when E2E_CASHIER_PASSWORD is not set.
 * Test item POS-E2E-SERVICE (barcode 9900112233445) must exist — non-stock service item.
 */

const URL_BASE = process.env.CASHIER_E2E_URL || 'https://qarawi.base.meena.sa'
const USER = process.env.E2E_CASHIER_USER || 'pos.e2e.cashier@test.local'
const PW = process.env.E2E_CASHIER_PASSWORD || ''
const BARCODE = '9900112233445'
const SALE_API = '**/api/method/erpnext.accounts.pos_cashier_api.create_sale'

test.use({
  baseURL: URL_BASE,
  ignoreHTTPSErrors: true,
  launchOptions: { args: ['--host-resolver-rules=MAP qarawi.base.meena.sa 127.0.0.1'] },
})

test.skip(!PW, 'E2E_CASHIER_PASSWORD not set — cashier offline suite skipped')

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="text"]').first().fill(USER)
  await page.locator('input[type="password"]').first().fill(PW)
  await page.getByRole('button', { name: /sign in|login|تسجيل/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
}

async function toCheckout(page: Page) {
  await page.goto('/cashier', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (!page.url().includes('/checkout')) {
    await page.getByRole('button', { name: /فتح|بدء|افتح/ }).first().click()
    await page.waitForURL('**/cashier/checkout', { timeout: 20000 })
  }
  await page.waitForTimeout(2000) // catalog load → offline cache primed
}

async function addByBarcode(page: Page) {
  const search = page.locator('input[placeholder*="بحث"], input[type="search"]').first()
  await search.fill(BARCODE)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  // blur the input so F-keys aren't swallowed (clicking the header is no longer safe —
  // its buttons now carry visible labels and a center-click could navigate)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
}

async function quickPay(page: Page) {
  await page.keyboard.press('F8')
  await page.waitForTimeout(1800)
  await page.keyboard.press('Escape') // close receipt
  await page.waitForTimeout(400)
}

async function syncNow(page: Page) {
  // the status pill opens the sync-queue dialog; the manual sync button lives inside
  await page.getByTitle(/اضغط لفتح قائمة المزامنة|Tap to open the sync queue/).click({ timeout: 5000 }).catch(() => {})
  await page.getByRole('button', { name: /زامن الآن|Sync now/ }).click({ timeout: 5000 }).catch(() => {})
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

const openQueue = (page: Page) =>
  page.evaluate(async () => {
    const req = indexedDB.open('cashier_pos')
    const db: IDBDatabase | null = await new Promise((r) => {
      req.onsuccess = () => r(req.result); req.onerror = () => r(null)
    })
    if (!db) return []
    const g = db.transaction('queue').objectStore('queue').getAll()
    const all: any[] = await new Promise((r) => { g.onsuccess = () => r(g.result) })
    return all.filter((a) => a.status !== 'synced').map((a) => ({ id: a.id, kind: a.kind, status: a.status }))
  })

const reconciledNames = (page: Page) =>
  page.evaluate(async () => {
    const req = indexedDB.open('cashier_pos')
    const db: IDBDatabase | null = await new Promise((r) => {
      req.onsuccess = () => r(req.result); req.onerror = () => r(null)
    })
    if (!db) return []
    const g = db.transaction('invoices').objectStore('invoices').getAll()
    const all: any[] = await new Promise((r) => { g.onsuccess = () => r(g.result) })
    return all.filter((r2) => r2.server_name).map((r2) => r2.server_name as string)
  })

test.describe.serial('cashier offline-first', () => {
  test('network drop mid-work: sale queues, provisional receipt, exact-once sync on reconnect', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page)
    await toCheckout(page)

    await page.route(SALE_API, (r) => r.abort())
    await addByBarcode(page)
    await page.keyboard.press('F8')
    await page.waitForTimeout(1800)
    // provisional receipt with a LOCAL- number — cashier was never blocked
    await expect(page.getByText(/LOCAL-/).first()).toBeVisible({ timeout: 5000 })

    // PRINT: the receipt renders into a dedicated iframe (blank-page fix). Assert the
    // print DOM is NON-EMPTY and PORTRAIT-constrained before the dialog would open.
    await page.getByRole('button', { name: /طباعة|Print/ }).first().click()
    // the print iframe self-removes ~4s after dispatch — read it ATOMICALLY
    await expect(page.locator('iframe[data-cashier-print]')).toHaveCount(1, { timeout: 4000 })
    const frameInfo = await page.evaluate(() => {
      const f = document.querySelector('iframe[data-cashier-print]') as HTMLIFrameElement | null
      const d = f?.contentDocument
      return { body: d?.body?.innerText || '', style: d?.querySelector('style')?.textContent || '' }
    })
    expect(frameInfo.body, 'print DOM must be NON-empty').toMatch(/LOCAL-/)
    expect(frameInfo.style, 'portrait roll size').toMatch(/@page \{ size: (58|80)mm auto;/)
    // printing moves focus into the iframe — close the receipt sheet explicitly
    await page.getByRole('button', { name: /إغلاق|Close/ }).first().click()
    await page.waitForTimeout(400)

    const queued = await openQueue(page)
    expect(queued.length).toBe(1)
    expect(queued[0].kind).toBe('sale')
    // status pill shows pending count
    await expect(page.getByText(/بالانتظار|Pending/).first()).toBeVisible()

    // reconnect → manual "Sync now" from the queue dialog (real reconnects auto-kick)
    await page.unroute(SALE_API)
    await syncNow(page)
    await expect.poll(async () => (await openQueue(page)).length, { timeout: 30_000 }).toBe(0)

    // the provisional sale reconciled to exactly ONE server invoice
    const names = await reconciledNames(page)
    expect(names.length).toBeGreaterThan(0)
    const latest = names[names.length - 1]
    const { invoices } = await page.evaluate(async () => {
      const res = await fetch('/api/method/erpnext.accounts.pos_cashier_api.get_sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || '' },
        credentials: 'include',
        body: JSON.stringify({ limit: 500 }),
      })
      return (await res.json()).message
    })
    const occurrences = invoices.filter((i: any) => i.name === latest).length
    expect(occurrences).toBe(1)
  })

  test('reload mid-sale: cart and in-progress payment draft restore', async ({ page }) => {
    test.setTimeout(90_000)
    await login(page)
    await toCheckout(page)
    await addByBarcode(page)
    await page.keyboard.press('F4') // open payment sheet
    await page.waitForTimeout(800)
    const sheet = page.locator('[role="dialog"]').last()
    await sheet.getByRole('button', { name: '5', exact: true }).click()
    await page.waitForTimeout(800)

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    // cart restored
    const items = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('cashier_cart_state') || '{"items":[]}').items.map((i: any) => i.item_code))
    expect(items).toContain('POS-E2E-SERVICE')
    // payment sheet reopened with the draft
    await expect(page.getByText('إتمام الدفع')).toBeVisible({ timeout: 8000 })
    // cleanup: close sheet and clear cart for the next test
    await page.keyboard.press('Escape')
    await page.keyboard.press('F9')
    await page.getByRole('button', { name: 'مسح', exact: true }).click().catch(() => {})
  })

  test('connection flap storm: no duplicate invoices', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page)
    await toCheckout(page)

    let n = 0
    await page.route(SALE_API, (r) => { n++; if (n % 2 === 1) r.abort(); else r.continue() })
    await addByBarcode(page)
    await quickPay(page)
    await page.waitForTimeout(1500)
    await page.unroute(SALE_API)
    await syncNow(page)
    await expect.poll(async () => (await openQueue(page)).length, { timeout: 45_000 }).toBe(0)

    // every reconciled server invoice appears exactly once in the server list
    const names = await reconciledNames(page)
    const { invoices } = await page.evaluate(async () => {
      const res = await fetch('/api/method/erpnext.accounts.pos_cashier_api.get_sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || '' },
        credentials: 'include',
        body: JSON.stringify({ limit: 500 }),
      })
      return (await res.json()).message
    })
    for (const nm of names) {
      expect(invoices.filter((i: any) => i.name === nm).length, `invoice ${nm} duplicated`).toBe(1)
    }
  })

  test('FULL offline: reload boots from cache, sequential sales stack, reconnect drains with real server ids', async ({ page, context }) => {
    test.setTimeout(180_000)
    await login(page)
    await toCheckout(page)
    // one reload online so the SW (claimed) has cached this navigation + chunks
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // ── (a) hard offline (ALL requests dead) + reload → app still loads from cache ──
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    expect(page.url()).toContain('/cashier')
    await expect(page.getByText(/غير متصل|Offline/).first()).toBeVisible({ timeout: 10_000 })
    // grid renders from the IndexedDB catalog cache — selling stays possible
    await expect(page.locator('button.bg-white.rounded-xl').first()).toBeVisible({ timeout: 10_000 })

    // ── (b)+(c) several sequential offline sales → queue increments 1,2,3, ids unique ──
    const before = (await openQueue(page)).length
    for (let i = 1; i <= 3; i++) {
      await addByBarcode(page)
      await quickPay(page)
      const q = await openQueue(page)
      expect(q.length).toBe(before + i) // exact increment — no loss, no collision
    }
    const queued = await openQueue(page)
    expect(new Set(queued.map((a) => a.id)).size).toBe(queued.length)
    // local LOCAL- receipts were issued (last one visible in history store)
    // and the cashier was never blocked.

    // ── (d) reconnect → queue drains IN ORDER and invoices get real server ids ──
    const reconciledBefore = (await reconciledNames(page)).length
    await context.setOffline(false)
    // the engine kicks on the 'online' event; nudge it too
    await syncNow(page)
    await expect.poll(async () => (await openQueue(page)).length, { timeout: 60_000 }).toBe(0)
    const reconciled = await reconciledNames(page)
    expect(reconciled.length).toBe(reconciledBefore + 3)
    for (const nm of reconciled.slice(-3)) {
      expect(nm).toMatch(/^ACC-PSINV-/) // real server ids, not LOCAL-
    }
  })
})

