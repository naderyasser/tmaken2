/**
 * E2E Tests: Sales Rep Free Samples Page
 * Tests the full distribution flow with mocked API
 *
 * NOTE on Playwright route ordering:
 *   Routes use LIFO — LAST registered route wins.
 *   So: catch-alls registered FIRST, specific mocks registered LAST.
 *
 * NOTE on response formats:
 *   /api/resource/*  →  { data: T }   (frappeClient.getList uses result.data)
 *   /api/method/*    →  { message: T } (frappeClient.call / salesApi use result.message)
 *   /api/frappe?path →  { message: T } (lib/api.ts uses data.message)
 */

import { test, expect, type Page } from '@playwright/test'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_USER_EMAIL = 'salesrep@test.com'

const MOCK_AVAILABLE_SAMPLES = [
    { item_code: 'ITEM-OLIVE-1L', item_name: 'زيت الزيتون 1 لتر', stock_uom: 'Nos', total_allocated: 50, total_distributed: 10, total_remaining: 40 },
    { item_code: 'ITEM-RICE-2KG', item_name: 'أرز بسمتي 2 كج', stock_uom: 'Nos', total_allocated: 30, total_distributed: 5, total_remaining: 25 },
]

const MOCK_HISTORY = [
    {
        name: 'DIST-001',
        sales_person: 'SP-001',
        sales_person_name: 'Ahmed Sales',
        customer: 'CUST-001',
        customer_name: 'شركة النور للتجارة',
        distribution_date: new Date().toISOString(),
        total_qty: 3,
        customer_confirmed: 1,
        status: 'Completed',
        notes: 'توزيع تجريبي',
        gps_latitude: 24.7136,
        gps_longitude: 46.6753,
        items: [{ item_code: 'ITEM-OLIVE-1L', item_name: 'زيت الزيتون 1 لتر', qty: 2, uom: 'Nos' }],
    },
]

const MOCK_CUSTOMERS = [
    { name: 'CUST-001', customer_name: 'شركة النور للتجارة', territory: 'Riyadh' },
    { name: 'CUST-002', customer_name: 'مؤسسة الخليج', territory: 'Jeddah' },
]

// ─── Setup ───────────────────────────────────────────────────────────────────

async function setupMocks(page: Page, opts: { emptySamples?: boolean; emptyHistory?: boolean } = {}) {
    // ── CATCH-ALLS first (lowest priority) ──────────────────────────────
    // Any unmatched /api/resource or /api/method returns empty success
    await page.route(/\/api\/resource\//, (r) =>
        r.fulfill({ status: 200, json: { data: [] } })
    )
    await page.route(/\/api\/method\//, (r) =>
        r.fulfill({ status: 200, json: { message: null } })
    )
    // /api/frappe catch-all
    await page.route(/\/api\/frappe/, (r) =>
        r.fulfill({ status: 200, json: { message: null } })
    )

    // ── SPECIFIC MOCKS last (highest priority) ───────────────────────────

    // CSRF token (via /api/method direct call)
    await page.route(/base_meena\.api\.get_csrf_token/, (r) =>
        r.fulfill({ status: 200, json: { message: { csrf_token: 'test-csrf-123' } } })
    )

    // Stock
    await page.route(/get_salesperson_stock/, (r) =>
        r.fulfill({ status: 200, json: { message: [] } })
    )

    // Customers — { data: [...] }
    await page.route(/\/api\/resource\/Customer/, (r) =>
        r.fulfill({ status: 200, json: { data: MOCK_CUSTOMERS } })
    )

    // Sales Person detail — { data: {...} }
    await page.route(/\/api\/resource\/Sales%20Person\/SP-001/, (r) =>
        r.fulfill({ status: 200, json: { data: { name: 'SP-001', sales_person_name: 'Ahmed Sales', is_group: 0, enabled: 1, employee: 'EMP-001', inventory_warehouse: null, has_inventory: 0 } } })
    )
    // Sales Person list — { data: [...] }
    await page.route(/\/api\/resource\/Sales%20Person/, (r) =>
        r.fulfill({ status: 200, json: { data: [{ name: 'SP-001', sales_person_name: 'Ahmed Sales', parent_sales_person: 'Sales Team', enabled: 1, employee: 'EMP-001' }] } })
    )

    // Employee list — { data: [...] }
    await page.route(/\/api\/resource\/Employee/, (r) =>
        r.fulfill({ status: 200, json: { data: [{ name: 'EMP-001', employee_name: 'Ahmed Sales Rep', company: 'Test Company' }] } })
    )

    // Free Samples — { message: [...] } (frappeClient.call)
    await page.route(/distribute_samples/, (r) =>
        r.fulfill({ status: 200, json: { message: { name: 'DIST-NEW', status: 'Completed' } } })
    )
    await page.route(/get_allowed_customers/, (r) =>
        r.fulfill({ status: 200, json: { message: { allow_all: true, customers: [] } } })
    )
    await page.route(/get_distribution_history/, (r) =>
        r.fulfill({ status: 200, json: { message: opts.emptyHistory ? [] : MOCK_HISTORY } })
    )
    await page.route(/get_available_samples/, (r) =>
        r.fulfill({ status: 200, json: { message: opts.emptySamples ? [] : MOCK_AVAILABLE_SAMPLES } })
    )

    // Auth via /api/frappe proxy — { message: ... }
    // getUserInfo: /api/frappe?path=/api/resource/User/...
    await page.route(/\/api\/frappe\?.*User%2F/, (r) =>
        r.fulfill({ status: 200, json: { data: { full_name: 'Ahmed Sales Rep', user_image: null } } })
    )
    await page.route(/\/api\/frappe\?.*\/User\//, (r) =>
        r.fulfill({ status: 200, json: { data: { full_name: 'Ahmed Sales Rep', user_image: null } } })
    )
    // getUserRoles: /api/frappe?path=...get_roles...
    await page.route(/\/api\/frappe\?.*get_roles/, (r) =>
        r.fulfill({ status: 200, json: { message: ['Sales Person', 'Sales User', 'System Manager'] } })
    )
    // getCurrentUser: /api/frappe?path=/api/method/frappe.auth.get_logged_user
    await page.route(/\/api\/frappe\?.*get_logged_user/, (r) =>
        r.fulfill({ status: 200, json: { message: MOCK_USER_EMAIL } })
    )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Sales Rep - Free Samples (/sales-rep/samples)', () => {

    test.beforeEach(async ({ page }) => {
        await setupMocks(page)
        await page.goto('/sales-rep/samples')
        await page.waitForSelector('text=العينات المجانية', { timeout: 20000 })
    })

    // ── Available Tab ────────────────────────────────────────────────────

    test('shows page header', async ({ page }) => {
        await expect(page.getByText('العينات المجانية')).toBeVisible()
        await expect(page.getByText('توزيع العينات على العملاء')).toBeVisible()
    })

    test('shows available samples list', async ({ page }) => {
        await expect(page.getByText('زيت الزيتون 1 لتر')).toBeVisible()
        await expect(page.getByText('أرز بسمتي 2 كج')).toBeVisible()
    })

    test('shows remaining quantities', async ({ page }) => {
        await expect(page.getByText('40')).toBeVisible()
        await expect(page.getByText('25')).toBeVisible()
    })

    test('shows summary badges', async ({ page }) => {
        await expect(page.getByText(/2 صنف متاح/)).toBeVisible()
        await expect(page.getByText(/65 وحدة متبقية/)).toBeVisible()
    })

    test('distribute button switches tab', async ({ page }) => {
        await page.getByRole('button', { name: 'وزّع عينات' }).click()
        await expect(page.getByText('اختر العميل')).toBeVisible()
    })

    // ── History Tab ──────────────────────────────────────────────────────

    test('shows distribution history', async ({ page }) => {
        await page.getByRole('button', { name: 'السجل' }).click()
        await expect(page.getByText('شركة النور للتجارة')).toBeVisible()
        await expect(page.getByText('3 وحدة')).toBeVisible()
        await expect(page.getByText('مؤكد')).toBeVisible()
    })

    test('expands history entry to show items', async ({ page }) => {
        await page.getByRole('button', { name: 'السجل' }).click()
        await page.getByText('شركة النور للتجارة').click()
        await expect(page.getByText('زيت الزيتون 1 لتر')).toBeVisible()
        await expect(page.getByText('توزيع تجريبي')).toBeVisible()
    })

    // ── Distribute Tab ───────────────────────────────────────────────────

    test('customer picker shows both customers', async ({ page }) => {
        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'ابحث عن عميل' }).click()
        await expect(page.getByText('شركة النور للتجارة')).toBeVisible()
        await expect(page.getByText('مؤسسة الخليج')).toBeVisible()
    })

    test('customer search filters list', async ({ page }) => {
        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'ابحث عن عميل' }).click()
        await page.getByPlaceholder('ابحث بالاسم أو الكود...').fill('الخليج')
        await expect(page.getByText('مؤسسة الخليج')).toBeVisible()
        await expect(page.getByText('شركة النور للتجارة')).not.toBeVisible()
    })

    test('selects customer and shows change button', async ({ page }) => {
        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'ابحث عن عميل' }).click()
        await page.getByText('شركة النور للتجارة').first().click()
        await expect(page.getByRole('button', { name: 'تغيير' })).toBeVisible()
    })

    test('adding item shows quantity controls', async ({ page }) => {
        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'إضافة' }).first().click()
        await expect(page.locator('span.font-bold.text-sm').first()).toHaveText('1')
    })

    test('removing item brings back add button', async ({ page }) => {
        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'إضافة' }).first().click()
        await page.locator('button.text-red-500').first().click()
        await expect(page.getByRole('button', { name: 'إضافة' }).first()).toBeVisible()
    })

    test('summary card appears when customer + item selected', async ({ page }) => {
        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'ابحث عن عميل' }).click()
        await page.getByText('شركة النور للتجارة').first().click()
        await page.getByRole('button', { name: 'إضافة' }).first().click()
        await expect(page.getByText('ملخص التوزيع')).toBeVisible()
    })

    test('confirmation dialog shows item and customer', async ({ page }) => {
        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'ابحث عن عميل' }).click()
        await page.getByText('شركة النور للتجارة').first().click()
        await page.getByRole('button', { name: 'إضافة' }).first().click()
        await page.getByRole('button', { name: 'تأكيد التوزيع' }).click()
        await expect(page.getByText('هل أنت متأكد من توزيع العينات التالية؟')).toBeVisible()
        await expect(page.getByText('زيت الزيتون 1 لتر')).toBeVisible()
        // Cancel works
        await page.getByRole('button', { name: 'إلغاء' }).click()
        await expect(page.getByText('هل أنت متأكد من توزيع العينات التالية؟')).not.toBeVisible()
    })

    // ── Full Distribution Flow ────────────────────────────────────────────

    test('completes full distribution → success message + API called', async ({ page }) => {
        let apiCalled = false
        await page.route(/distribute_samples/, async (r) => {
            apiCalled = true
            await r.fulfill({ status: 200, json: { message: { name: 'DIST-NEW', status: 'Completed' } } })
        })

        await page.getByRole('button', { name: 'توزيع' }).click()
        await page.getByRole('button', { name: 'ابحث عن عميل' }).click()
        await page.getByText('شركة النور للتجارة').first().click()
        await page.getByRole('button', { name: 'إضافة' }).first().click()
        await page.getByRole('button', { name: 'تأكيد التوزيع' }).click()
        await page.getByRole('button', { name: 'تأكيد' }).last().click()

        await expect(page.getByText(/تم توزيع/)).toBeVisible({ timeout: 8000 })
        expect(apiCalled).toBe(true)
    })

    // ── Empty States ─────────────────────────────────────────────────────

    test('shows empty state when no samples', async ({ page }) => {
        await page.route(/get_available_samples/, (r) =>
            r.fulfill({ status: 200, json: { message: [] } })
        )
        await page.goto('/sales-rep/samples')
        await page.waitForSelector('text=العينات المجانية', { timeout: 20000 })
        await expect(page.getByText('لا توجد عينات مخصصة لك حالياً')).toBeVisible()
    })

    test('shows empty history state', async ({ page }) => {
        await page.route(/get_distribution_history/, (r) =>
            r.fulfill({ status: 200, json: { message: [] } })
        )
        await page.goto('/sales-rep/samples')
        await page.waitForSelector('text=العينات المجانية', { timeout: 20000 })
        await page.getByRole('button', { name: 'السجل' }).click()
        await expect(page.getByText('لا يوجد سجل توزيع سابق')).toBeVisible()
    })

    // ── Mobile ───────────────────────────────────────────────────────────

    test('works on mobile viewport (390x844)', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await expect(page.getByText('العينات المجانية')).toBeVisible()
        await expect(page.getByText('زيت الزيتون 1 لتر')).toBeVisible()
        await page.getByRole('button', { name: 'توزيع' }).click()
        await expect(page.getByText('اختر العميل')).toBeVisible()
    })
})
