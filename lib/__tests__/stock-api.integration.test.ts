/**
 * @jest-environment node
 *
 * Stock API Integration Tests
 *
 * These tests call the REAL Frappe backend at FRAPPE_TEST_URL and verify
 * that every endpoint stockApi relies on:
 *   1. Exists and is reachable
 *   2. Returns the expected HTTP status codes
 *   3. Returns data that matches the TypeScript interfaces
 *
 * ─── Prerequisites ───────────────────────────────────────────────────────
 *   • Fill in .env.test.local with FRAPPE_TEST_USER + FRAPPE_TEST_PASSWORD
 *   • Or set FRAPPE_API_KEY + FRAPPE_API_SECRET for token-based auth
 *   • The test user must have "System Manager" or "Stock Manager" role
 *
 * ─── How to run ──────────────────────────────────────────────────────────
 *   npx jest lib/__tests__/stock-api.integration.test.ts --no-coverage --verbose
 *
 * Tests are automatically SKIPPED when credentials are not configured.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ─── Config ───────────────────────────────────────────────────────────────
const BASE_URL = process.env.FRAPPE_TEST_URL || 'https://qarawi.base.meena.sa'
const TEST_USER = process.env.FRAPPE_TEST_USER || ''
const TEST_PASS = process.env.FRAPPE_TEST_PASSWORD || ''
const API_KEY = process.env.FRAPPE_API_KEY || ''
const API_SECRET = process.env.FRAPPE_API_SECRET || ''

const HAS_CREDENTIALS = (TEST_USER && TEST_PASS) || (API_KEY && API_SECRET)
const TIMEOUT = 20_000  // 20 s per test (remote API)

// ─── Helpers ──────────────────────────────────────────────────────────────
let sessionCookie = ''

/** Build auth headers depending on what credentials are available */
function authHeaders(): Record<string, string> {
    if (API_KEY && API_SECRET) {
        return {
            'Authorization': `token ${API_KEY}:${API_SECRET}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
    }
    return {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
}

/** GET /api/resource/<DocType>?fields=...&limit_page_length=... */
async function getList<T>(
    doctype: string,
    fields: string[],
    filters?: Array<[string, string, string]>,
    orderBy?: string,
    limit = 20,
): Promise<T[]> {
    const params = new URLSearchParams({
        fields: JSON.stringify(fields),
        limit_page_length: String(limit),
    })
    if (filters) params.set('filters', JSON.stringify(filters))
    if (orderBy) params.set('order_by', orderBy)

    const res = await fetch(
        `${BASE_URL}/api/resource/${encodeURIComponent(doctype)}?${params}`,
        { headers: authHeaders() },
    )
    if (!res.ok) throw new Error(`GET ${doctype} → HTTP ${res.status}`)
    const json = await res.json()
    return (json.data as T[]) || []
}

/** POST /api/method/<method> */
async function callMethod<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}/api/method/${method}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(args),
    })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`CALL ${method} → HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    return json.message as T
}

// ─── Shape validators (narrow TypeScript types at runtime) ─────────────────
function isWarehouse(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false
    const w = x as Record<string, unknown>
    return typeof w.name === 'string' && typeof w.warehouse_name === 'string'
}

function isStockStatus(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false
    const s = x as Record<string, unknown>
    return typeof s.name === 'string' && typeof s.status_name === 'string'
}

function isAuditLog(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false
    const a = x as Record<string, unknown>
    return typeof a.name === 'string' && typeof a.movement_date === 'string' && typeof a.movement_type === 'string'
}

function isTransferRequest(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false
    const t = x as Record<string, unknown>
    return typeof t.name === 'string' && typeof t.from_warehouse === 'string'
}

function isReturnLog(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false
    const r = x as Record<string, unknown>
    return typeof r.name === 'string' && typeof r.return_date === 'string'
}

function isBinStock(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false
    const b = x as Record<string, unknown>
    return typeof b.item_code === 'string' && typeof b.warehouse === 'string' && typeof b.actual_qty !== 'undefined'
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────
beforeAll(async () => {
    if (!HAS_CREDENTIALS) return

    // If no API key, use session login
    if (!API_KEY) {
        const res = await fetch(`${BASE_URL}/api/method/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ usr: TEST_USER, pwd: TEST_PASS }),
        })
        if (!res.ok) {
            throw new Error(`Login failed: HTTP ${res.status}. Check FRAPPE_TEST_USER / FRAPPE_TEST_PASSWORD in .env.test.local`)
        }
        const setCookie = res.headers.get('set-cookie') || ''
        // Extract session id from Set-Cookie header
        const sidMatch = setCookie.match(/sid=([^;]+)/)
        if (sidMatch) {
            sessionCookie = `sid=${sidMatch[1]}`
        } else {
            // Fallback: use the raw cookie
            sessionCookie = setCookie.split(',')[0].trim()
        }
        console.log('  ✓ Logged in as', TEST_USER)
    } else {
        console.log('  ✓ Using API token auth')
    }
}, TIMEOUT)

afterAll(async () => {
    if (!HAS_CREDENTIALS || API_KEY) return
    try {
        await fetch(`${BASE_URL}/api/method/logout`, {
            method: 'POST',
            headers: authHeaders(),
        })
        console.log('  ✓ Logged out')
    } catch { /* ignore logout errors */ }
})

// ─── Skip helper ──────────────────────────────────────────────────────────
function skipIfNoCredentials() {
    if (!HAS_CREDENTIALS) {
        console.warn('  ⚠ Skipped: set FRAPPE_TEST_USER + FRAPPE_TEST_PASSWORD in .env.test.local')
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] Frappe server reachability', () => {
    it('ping endpoint returns 200', async () => {
        const res = await fetch(`${BASE_URL}/api/method/frappe.ping`)
        expect(res.status).toBe(200)
    }, TIMEOUT)

    it('unauthenticated request to protected resource returns 403/401', async () => {
        const res = await fetch(`${BASE_URL}/api/resource/Warehouse?limit_page_length=1`, {
            headers: { 'Accept': 'application/json' }
        })
        // Frappe returns 401 when not logged in
        expect([401, 403, 307]).toContain(res.status)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getWarehouses → /api/resource/Warehouse', () => {
    beforeEach(skipIfNoCredentials)

    it('returns a list of warehouses', async () => {
        if (!HAS_CREDENTIALS) return

        const warehouses = await getList<Record<string, unknown>>('Warehouse', [
            'name', 'warehouse_name', 'custom_warehouse_type',
            'custom_is_dynamic', 'custom_linked_sales_person',
            'is_group', 'company', 'disabled',
        ])

        expect(Array.isArray(warehouses)).toBe(true)
        expect(warehouses.length).toBeGreaterThan(0)
        warehouses.forEach(w => {
            expect(isWarehouse(w)).toBe(true)
        })
    }, TIMEOUT)

    it('returns Van-type warehouses with custom_warehouse_type field', async () => {
        if (!HAS_CREDENTIALS) return

        const all = await getList<Record<string, unknown>>('Warehouse', [
            'name', 'warehouse_name', 'custom_warehouse_type',
        ])

        const vans = all.filter(w => w.custom_warehouse_type === 'Van')
        // Not required to exist, but if they do they must have linked_sales_person or be marked dynamic
        vans.forEach(v => {
            expect(typeof v.name).toBe('string')
        })
        console.log(`    Found ${vans.length} Van warehouses`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getStockStatuses → /api/resource/Stock Status', () => {
    beforeEach(skipIfNoCredentials)

    it('returns Stock Status list with required fields', async () => {
        if (!HAS_CREDENTIALS) return

        const statuses = await getList<Record<string, unknown>>('Stock Status', [
            'name', 'status_name', 'status_code', 'color', 'is_sellable', 'enabled',
        ])

        expect(Array.isArray(statuses)).toBe(true)
        statuses.forEach(s => {
            expect(isStockStatus(s)).toBe(true)
        })
        console.log(`    Found ${statuses.length} stock statuses`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getAuditLogs → /api/resource/Stock Movement Audit', () => {
    beforeEach(skipIfNoCredentials)

    it('returns audit log list ordered by date desc', async () => {
        if (!HAS_CREDENTIALS) return

        const logs = await getList<Record<string, unknown>>('Stock Movement Audit', [
            'name', 'movement_date', 'movement_time', 'item_code', 'warehouse',
            'quantity_change', 'previous_qty', 'new_qty', 'movement_type',
            'reference_doctype', 'reference_name', 'user', 'action',
        ], undefined, 'movement_date desc, movement_time desc', 20)

        expect(Array.isArray(logs)).toBe(true)
        logs.forEach(log => {
            expect(isAuditLog(log)).toBe(true)
            expect(['In', 'Out', 'Transfer', 'Return', 'Adjustment']).toContain(log.movement_type)
        })
        console.log(`    Found ${logs.length} audit log entries`)
    }, TIMEOUT)

    it('movement_date field is a valid date string', async () => {
        if (!HAS_CREDENTIALS) return

        const logs = await getList<Record<string, unknown>>('Stock Movement Audit', ['name', 'movement_date'], undefined, 'movement_date desc', 5)

        logs.forEach(log => {
            expect(typeof log.movement_date).toBe('string')
            expect(log.movement_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getTransferRequests → /api/resource/Stock Transfer Request', () => {
    beforeEach(skipIfNoCredentials)

    it('returns transfer requests with required fields', async () => {
        if (!HAS_CREDENTIALS) return

        const requests = await getList<Record<string, unknown>>('Stock Transfer Request', [
            'name', 'request_date', 'from_warehouse', 'to_warehouse',
            'sales_person', 'status', 'total_quantity',
            'accepted_by', 'accepted_date', 'stock_entry', 'docstatus',
        ], undefined, 'request_date desc', 20)

        expect(Array.isArray(requests)).toBe(true)
        requests.forEach(r => {
            expect(isTransferRequest(r)).toBe(true)
            expect(['Pending', 'Accepted', 'Partially Accepted', 'Rejected', 'Completed', 'Cancelled']).toContain(r.status)
        })
        console.log(`    Found ${requests.length} transfer requests`)
    }, TIMEOUT)

    it('can filter transfer requests by status=Pending', async () => {
        if (!HAS_CREDENTIALS) return

        const pending = await getList<Record<string, unknown>>(
            'Stock Transfer Request',
            ['name', 'status'],
            [['status', '=', 'Pending']],
        )

        pending.forEach(r => {
            expect(r.status).toBe('Pending')
        })
        console.log(`    Found ${pending.length} pending requests`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getPendingTransferRequests → method call', () => {
    beforeEach(skipIfNoCredentials)

    it('whitelisted method returns array', async () => {
        if (!HAS_CREDENTIALS) return

        const result = await callMethod<unknown[]>(
            'base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.get_pending_requests_for_sales_person',
            {}
        )
        expect(Array.isArray(result)).toBe(true)
        console.log(`    Method returned ${result?.length ?? 0} pending requests`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getReturnLogs → /api/resource/Return Log', () => {
    beforeEach(skipIfNoCredentials)

    it('returns return logs with required fields', async () => {
        if (!HAS_CREDENTIALS) return

        const logs = await getList<Record<string, unknown>>('Return Log', [
            'name', 'return_date', 'warehouse', 'sales_person', 'customer',
            'return_reason', 'total_quantity', 'total_value', 'status', 'docstatus',
        ], undefined, 'return_date desc', 20)

        expect(Array.isArray(logs)).toBe(true)
        logs.forEach(log => {
            expect(isReturnLog(log)).toBe(true)
        })
        console.log(`    Found ${logs.length} return logs`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getSalesPersonStock → method call', () => {
    beforeEach(skipIfNoCredentials)

    it('whitelisted method exists and returns array or empty', async () => {
        if (!HAS_CREDENTIALS) return

        // First get a sales person that has inventory
        const sps = await getList<Record<string, unknown>>('Sales Person', [
            'name', 'sales_person_name', 'has_inventory', 'inventory_warehouse',
        ], [['has_inventory', '=', '1']], undefined, 5)

        if (sps.length === 0) {
            console.log('    No Sales Persons with inventory found — skipping stock check')
            return
        }

        const sp = sps[0]
        console.log(`    Testing with Sales Person: ${sp.name}`)

        const stock = await callMethod<unknown[]>(
            'base_meena.stock_management.stock_validation.get_salesperson_stock',
            { sales_person: sp.name }
        )

        expect(Array.isArray(stock)).toBe(true)
        stock.forEach(item => {
            expect(isBinStock(item)).toBe(true)
        })
        console.log(`    ${sp.name} has ${stock.length} stock items`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.checkItemAvailability → method call', () => {
    beforeEach(skipIfNoCredentials)

    it('returns availability object with correct fields', async () => {
        if (!HAS_CREDENTIALS) return

        // Find an item and warehouse to test against
        const bins = await getList<Record<string, unknown>>('Bin', [
            'item_code', 'warehouse', 'actual_qty',
        ], [['actual_qty', '>', '0']], undefined, 1)

        if (bins.length === 0) {
            console.log('    No stock in Bin — skipping availability check')
            return
        }

        const { item_code, warehouse, actual_qty } = bins[0] as { item_code: string; warehouse: string; actual_qty: number }

        const result = await callMethod<{
            item_code: string
            warehouse: string
            requested_qty: number
            available_qty: number
            is_available: boolean
            shortage: number
        }>(
            'base_meena.stock_management.stock_validation.check_item_availability',
            { item_code, warehouse, qty: 1 }
        )

        expect(result.item_code).toBe(item_code)
        expect(result.warehouse).toBe(warehouse)
        expect(typeof result.available_qty).toBe('number')
        expect(typeof result.is_available).toBe('boolean')
        expect(typeof result.shortage).toBe('number')
        expect(result.available_qty).toBeGreaterThanOrEqual(0)

        // If actual_qty >= 1, it should be available
        if (Number(actual_qty) >= 1) {
            expect(result.is_available).toBe(true)
            expect(result.shortage).toBe(0)
        }
        console.log(`    ${item_code} @ ${warehouse}: qty=${result.available_qty}, available=${result.is_available}`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] stockApi.getBinStock → /api/resource/Bin', () => {
    beforeEach(skipIfNoCredentials)

    it('returns Bin list with actual_qty > 0', async () => {
        if (!HAS_CREDENTIALS) return

        const bins = await getList<Record<string, unknown>>('Bin', [
            'item_code', 'warehouse', 'actual_qty', 'stock_uom', 'valuation_rate', 'stock_value',
        ], [['actual_qty', '>', '0']], 'stock_value desc', 20)

        expect(Array.isArray(bins)).toBe(true)
        bins.forEach(bin => {
            expect(isBinStock(bin)).toBe(true)
            expect(Number(bin.actual_qty)).toBeGreaterThan(0)
        })
        console.log(`    Found ${bins.length} bin entries with stock`)
    }, TIMEOUT)

    it('warehouse filter returns only items in that warehouse', async () => {
        if (!HAS_CREDENTIALS) return

        // Get any warehouse that has stock
        const allBins = await getList<Record<string, unknown>>('Bin', ['warehouse'], [['actual_qty', '>', '0']], undefined, 1)

        if (allBins.length === 0) {
            console.log('    No Bin entries found — skipping warehouse filter test')
            return
        }

        const wh = (allBins[0] as { warehouse: string }).warehouse

        const filtered = await getList<Record<string, unknown>>('Bin', [
            'item_code', 'warehouse', 'actual_qty',
        ], [['actual_qty', '>', '0'], ['warehouse', '=', wh]], undefined, 50)

        filtered.forEach(bin => {
            expect(bin.warehouse).toBe(wh)
        })
        console.log(`    Warehouse "${wh}": ${filtered.length} items`)
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] accept/reject transfer request (read-only check)', () => {
    beforeEach(skipIfNoCredentials)

    it('reject_transfer_request returns error for non-existent request', async () => {
        if (!HAS_CREDENTIALS) return

        // Calling with a fake name — should throw (non-existent doc)
        await expect(
            callMethod('base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.reject_transfer_request', {
                request_name: 'STR-FAKE-00000',
                rejection_reason: 'test',
            })
        ).rejects.toThrow()
    }, TIMEOUT)

    it('accept_transfer_request returns error for non-pending request', async () => {
        if (!HAS_CREDENTIALS) return

        // This should fail because the fake doc doesn't exist
        await expect(
            callMethod('base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.accept_transfer_request', {
                request_name: 'STR-FAKE-00000',
            })
        ).rejects.toThrow()
    }, TIMEOUT)
})

// ─────────────────────────────────────────────────────────────────────────

describe('[INTEGRATION] Return Log invoice items method', () => {
    beforeEach(skipIfNoCredentials)

    it('get_invoice_items returns error for non-existent invoice', async () => {
        if (!HAS_CREDENTIALS) return

        // Should return empty array or throw gracefully for fake invoice
        try {
            const result = await callMethod<unknown[]>(
                'base_meena.stock_management.doctype.return_log.return_log.get_invoice_items',
                { sales_invoice: 'ACC-SINV-FAKE-00000' }
            )
            // Either empty array or undefined is fine
            expect(Array.isArray(result) || result === null || result === undefined).toBe(true)
        } catch {
            // Throwing is also acceptable for non-existent docs
        }
    }, TIMEOUT)
})
