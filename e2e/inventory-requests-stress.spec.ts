/**
 * E2E Stress Tests: Inventory Requests (Stock Transfer Request)
 * =============================================================
 * Targets the exact concurrency / data-integrity failure modes that the
 * 2026-07-14 patch closed:
 *   - accept_transfer_request read status WITHOUT a row lock → two concurrent
 *     accepts both passed the "Pending" check → TWO Stock Entries → source
 *     warehouse deducted twice (phantom stock loss).
 *   - allow_negative_stock=1 (qarawi) silently disabled the sufficiency guard.
 *
 * TWO layers, because they catch different bugs:
 *   1. describe('FE state machine — mocked')  — deterministic, CI-safe. Proves
 *      the UI never double-fires and never optimistically advances past a
 *      backend rejection. Cannot prove a DB lock (mocks have no transaction).
 *   2. describe('Backend concurrency — LIVE')  — opt-in. Fires real parallel
 *      accepts at a real site and asserts EXACTLY ONE wins and the source is
 *      deducted ONCE. This is the only layer that proves the row lock.
 *
 * Run:
 *   Mocked (default):   npx playwright test e2e/inventory-requests-stress.spec.ts
 *   Live concurrency:   INV_LIVE=1 INV_BASE_URL=https://mandoob.base.meena.sa \
 *                       INV_COOKIE="sid=<admin session id>" \
 *                       npx playwright test e2e/inventory-requests-stress.spec.ts -g LIVE
 *
 * Getting INV_COOKIE: log into the admin site in a browser, copy the `sid`
 * cookie from DevTools → Application → Cookies. NEVER hard-code it here.
 *
 * Frappe response envelopes (match the existing sales specs):
 *   /api/resource/*  →  { data: T }
 *   /api/method/*    →  { message: T }
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const ACCEPT_METHOD =
  'base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.accept_transfer_request'

// ───────────────────────── Layer 1: FE state machine (mocked) ────────────────

const REQUEST_PENDING = {
  name: 'STR-2026-0001',
  request_date: '2026-07-14',
  from_warehouse: 'Meena Van 1 - M',
  to_warehouse: 'Van - مندوب محمود - M',
  sales_person: 'مندوب مينا التجريبي',
  status: 'Pending',
  total_quantity: 5,
  docstatus: 0,
  items: [{ item_code: 'MEENA-DEMO', item_name: 'Meena Demo Product', requested_qty: 5, uom: 'Nos' }],
}

const MOCK_ADMIN_EMAIL = 'admin@test.com'

/** Register catch-alls FIRST (LIFO — last route wins), specific mocks LAST. */
async function baseMocks(page: Page) {
  // transport catch-alls (frappeClient uses all three shapes)
  await page.route(/\/api\/resource\//, r => r.fulfill({ status: 200, json: { data: [] } }))
  await page.route(/\/api\/method\//, r => r.fulfill({ status: 200, json: { message: null } }))
  await page.route(/\/api\/frappe\?/, r => r.fulfill({ status: 200, json: { message: null } }))

  // auth gate — lib/api.ts hits these EXACT transports; without them
  // getCurrentUser() returns Guest and the dashboard bounces to /login
  await page.route(/\/api\/method\/frappe\.auth\.get_logged_user/, r =>
    r.fulfill({ status: 200, json: { message: MOCK_ADMIN_EMAIL } })
  )
  await page.route(/\/api\/method\/frappe\.core\.doctype\.user\.user\.get_roles/, r =>
    r.fulfill({ status: 200, json: { message: ['System Manager', 'Sales Manager', 'Sales User'] } })
  )
  await page.route(/\/api\/resource\/User\//, r =>
    r.fulfill({ status: 200, json: { data: { full_name: 'QA Admin', user_image: null } } })
  )

  // the admin list reads Stock Transfer Request (both direct and proxied shapes)
  await page.route(/\/api\/resource\/Stock(%20|\s)Transfer(%20|\s)Request/, r =>
    r.fulfill({ status: 200, json: { data: [REQUEST_PENDING] } })
  )
  await page.route(/\/api\/frappe\?.*Stock(%20|\s)Transfer(%20|\s)Request/, r =>
    r.fulfill({ status: 200, json: { message: [REQUEST_PENDING] } })
  )
}

// NOTE: fixme — these three drive the ADMIN dashboard, which gates its first
// render on the module-visibility list (auth-context awaits fetchAllowedModules
// before clearing isLoading). Getting them green needs one more harness layer:
// mock the module endpoint so the Sales module is "allowed", then the
// ?section=stock-requests sub-route renders the list. The auth gate itself is
// already solved above (get_logged_user / get_roles / User resource). The
// backend-concurrency layer below is the real proof of the race fix and runs
// green today. Remove `.fixme` once the module mock is added.
test.describe.fixme('Inventory Requests — FE state machine (mocked)', () => {
  test('accept is single-flight: a second click while in-flight fires no second POST', async ({ page }) => {
    await baseMocks(page)

    let acceptCalls = 0
    let release: () => void = () => {}
    const gate = new Promise<void>(res => (release = res))
    await page.route(new RegExp(ACCEPT_METHOD.replace(/\./g, '\\.')), async r => {
      acceptCalls += 1
      await gate // hold the first call open so a double-click can race it
      await r.fulfill({ status: 200, json: { message: { status: 'success', stock_entry: 'MAT-STE-0001' } } })
    })

    await page.goto('/sales-reps?section=stock-requests')
    // Open the pending request and locate its Accept control. Selectors are
    // text/role based so they survive styling churn; adjust the names to your
    // i18n if the sprint runs in English mode.
    await page.getByText('STR-2026-0001').first().click()
    const acceptBtn = page.getByRole('button', { name: /accept|قبول|اعتماد/i }).last()

    await acceptBtn.click()
    await acceptBtn.click({ force: true }).catch(() => {}) // should be disabled/no-op
    release()
    await expect.poll(() => acceptCalls, { timeout: 5000 }).toBe(1)
  })

  test('insufficient stock: request stays Pending and the backend reason is shown', async ({ page }) => {
    await baseMocks(page)
    await page.route(new RegExp(ACCEPT_METHOD.replace(/\./g, '\\.')), r =>
      r.fulfill({
        status: 417,
        json: {
          exc_type: 'ValidationError',
          _server_messages: JSON.stringify([
            JSON.stringify({ message: 'Insufficient stock in source warehouse: MEENA-DEMO Accepted 5, Available 2', title: 'Stock Transfer Error' }),
          ]),
        },
      })
    )
    await page.goto('/sales-reps?section=stock-requests')
    await page.getByText('STR-2026-0001').first().click()
    await page.getByRole('button', { name: /accept|قبول|اعتماد/i }).last().click()

    // the failure must surface AND the request must not optimistically flip
    await expect(page.getByText(/insufficient stock|المخزون/i)).toBeVisible()
    await expect(page.getByText(/pending|قيد الانتظار/i).first()).toBeVisible()
  })

  test('state mismatch: accepting an already-completed request surfaces the conflict', async ({ page }) => {
    await baseMocks(page)
    await page.route(new RegExp(ACCEPT_METHOD.replace(/\./g, '\\.')), r =>
      r.fulfill({
        status: 417,
        json: {
          exc_type: 'ValidationError',
          _server_messages: JSON.stringify([JSON.stringify({ message: 'Only pending requests can be accepted' })]),
        },
      })
    )
    await page.goto('/sales-reps?section=stock-requests')
    await page.getByText('STR-2026-0001').first().click()
    await page.getByRole('button', { name: /accept|قبول|اعتماد/i }).last().click()
    await expect(page.getByText(/only pending|قيد الانتظار فقط|pending/i)).toBeVisible()
  })
})

// ───────────────────────── Layer 2: backend concurrency (LIVE) ───────────────

const LIVE = process.env.INV_LIVE === '1'
const BASE = process.env.INV_BASE_URL || ''
const COOKIE = process.env.INV_COOKIE || ''

async function apiCall(ctx: APIRequestContext, method: string, args: Record<string, unknown>) {
  const res = await ctx.post(`${BASE}/api/method/${method}`, {
    headers: { Cookie: COOKIE, 'X-Frappe-CSRF-Token': process.env.INV_CSRF || '', 'Content-Type': 'application/json' },
    data: args,
    failOnStatusCode: false,
  })
  return { status: res.status(), body: await res.text() }
}

test.describe('Inventory Requests — backend concurrency (LIVE, opt-in)', () => {
  test.skip(!LIVE, 'set INV_LIVE=1 + INV_BASE_URL + INV_COOKIE to run against a real site')

  test('N concurrent accepts create exactly ONE Stock Entry (no double deduction)', async ({ playwright }) => {
    test.setTimeout(60_000)
    const ctx = await playwright.request.newContext()

    // 1) seed a fresh Pending request via the resource API (admin session).
    //    Van->van, 1 unit, so the reversal below is trivial.
    const seed = await ctx.post(`${BASE}/api/resource/Stock Transfer Request`, {
      headers: { Cookie: COOKIE, 'X-Frappe-CSRF-Token': process.env.INV_CSRF || '', 'Content-Type': 'application/json' },
      failOnStatusCode: false,
      data: {
        request_date: new Date().toISOString().slice(0, 10),
        from_warehouse: process.env.INV_SRC || 'Meena Van 1 - M',
        to_warehouse: process.env.INV_DST || 'Van - مندوب محمود - M',
        sales_person: process.env.INV_REP || 'مندوب مينا التجريبي',
        items: [{ item_code: process.env.INV_ITEM || 'MEENA-DEMO', requested_qty: 1, uom: 'Nos' }],
      },
    })
    expect(seed.ok(), `seed failed: ${await seed.text()}`).toBeTruthy()
    const requestName = (await seed.json()).data.name

    // 2) fire 5 accepts at once against the same Pending request.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => apiCall(ctx, ACCEPT_METHOD, { request_name: requestName }))
    )

    // 3) EXACTLY ONE must succeed; the rest must be rejected (not 500s).
    const ok = results.filter(r => r.status === 200 && /"status":\s*"success"/.test(r.body))
    const rejected = results.filter(r => /Only pending requests can be accepted/.test(r.body))
    expect(ok.length, `expected 1 winner, got ${ok.length}\n${results.map(r => r.status).join(',')}`).toBe(1)
    expect(rejected.length).toBe(results.length - 1)

    // 4) integrity: the request landed on Completed with a single stock_entry.
    const doc = await ctx.get(`${BASE}/api/resource/Stock Transfer Request/${encodeURIComponent(requestName)}`, {
      headers: { Cookie: COOKIE },
    })
    const data = (await doc.json()).data
    expect(data.status).toBe('Completed')
    expect(data.stock_entry).toBeTruthy()

    await ctx.dispose()
    // NOTE: leaves +1/-1 across the two vans. Reverse with an Unload/Transfer
    // in the admin UI, or run against seeded demo data you can reset.
  })
})
