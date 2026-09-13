/**
 * Stock API Unit Tests
 * 
 * Tests every function in stockApi (lib/stock-api.ts) by mocking
 * the global fetch so no real network is needed.
 *
 * Run: npx jest lib/__tests__/stock-api.test.ts --verbose
 */

// ─── 1. Mock the api-client module BEFORE importing stock-api ──────────────
// jest.mock is hoisted, so we can't reference variables declared with const/let
// in the factory. Use jest.fn() directly and pull the mocks out afterwards.

jest.mock('../api-client', () => ({
    frappeClient: {
        getList: jest.fn(),
        get: jest.fn(),
        call: jest.fn(),
    },
}))

// ─── 2. Import the module under test and pull out the mock references ──────
import { stockApi } from '../stock-api'
import { frappeClient } from '../api-client'

const mockGetList = frappeClient.getList as jest.Mock
const mockGet = frappeClient.get as jest.Mock
const mockCall = frappeClient.call as jest.Mock
import type {
    Warehouse,
    StockStatus,
    StockMovementAudit,
    StockTransferRequest,
    ReturnLog,
    BinStock,
} from '../stock-api'

// ─── 3. Helpers ───────────────────────────────────────────────────────────
beforeEach(() => {
    jest.clearAllMocks()
})

// ───────────────────────────────────────────────────────────────────────────
// Warehouse tests
// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getWarehouses', () => {
    const mockWarehouses: Warehouse[] = [
        {
            name: 'Stores - BM',
            warehouse_name: 'Stores',
            custom_warehouse_type: 'Main',
            custom_is_dynamic: 0,
            is_group: 0,
            company: 'Base Meena',
            disabled: 0,
        },
        {
            name: 'Van - Ahmed',
            warehouse_name: 'Van - Ahmed',
            custom_warehouse_type: 'Van',
            custom_is_dynamic: 1,
            custom_linked_sales_person: 'SP-Ahmed',
            is_group: 0,
            company: 'Base Meena',
            disabled: 0,
        },
    ]

    it('returns list of warehouses', async () => {
        mockGetList.mockResolvedValueOnce(mockWarehouses)

        const result = await stockApi.getWarehouses()

        expect(result).toEqual(mockWarehouses)
        expect(result).toHaveLength(2)
    })

    it('calls getList with correct doctype "Warehouse"', async () => {
        mockGetList.mockResolvedValueOnce(mockWarehouses)

        await stockApi.getWarehouses()

        expect(mockGetList).toHaveBeenCalledWith(
            'Warehouse',
            expect.objectContaining({
                fields: expect.arrayContaining(['name', 'warehouse_name', 'custom_warehouse_type']),
                limit_page_length: 500,
            })
        )
    })

    it('passes extra options through', async () => {
        mockGetList.mockResolvedValueOnce([])

        await stockApi.getWarehouses({ filters: [['disabled', '=', '0', '']] })

        expect(mockGetList).toHaveBeenCalledWith(
            'Warehouse',
            expect.objectContaining({
                filters: [['disabled', '=', '0', '']],
            })
        )
    })

    it('returns empty array when backend returns nothing', async () => {
        mockGetList.mockResolvedValueOnce([])
        const result = await stockApi.getWarehouses()
        expect(result).toEqual([])
    })

    it('throws on network error', async () => {
        mockGetList.mockRejectedValueOnce(new Error('Network error'))
        await expect(stockApi.getWarehouses()).rejects.toThrow('Network error')
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getVanWarehouses', () => {
    it('filters by custom_warehouse_type = Van', async () => {
        mockGetList.mockResolvedValueOnce([
            { name: 'Van - Ahmed', warehouse_name: 'Van - Ahmed', custom_warehouse_type: 'Van' },
        ])

        const result = await stockApi.getVanWarehouses()

        expect(result).toHaveLength(1)
        expect(result[0].custom_warehouse_type).toBe('Van')
        expect(mockGetList).toHaveBeenCalledWith(
            'Warehouse',
            expect.objectContaining({
                filters: expect.arrayContaining([
                    expect.arrayContaining(['Warehouse', 'custom_warehouse_type', '=', 'Van']),
                ]),
            })
        )
    })

    it('returns empty array when no Van warehouses', async () => {
        mockGetList.mockResolvedValueOnce([])
        const result = await stockApi.getVanWarehouses()
        expect(result).toEqual([])
    })
})

// ───────────────────────────────────────────────────────────────────────────
// Stock Status tests
// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getStockStatuses', () => {
    const mockStatuses: StockStatus[] = [
        { name: 'Good', status_name: 'Good', status_code: 'GOOD', color: '#00ff00', is_sellable: 1, enabled: 1 },
        { name: 'Damaged', status_name: 'Damaged', status_code: 'DMG', color: '#ff0000', is_sellable: 0, enabled: 1 },
    ]

    it('returns list of stock statuses', async () => {
        mockGetList.mockResolvedValueOnce(mockStatuses)

        const result = await stockApi.getStockStatuses()

        expect(result).toEqual(mockStatuses)
        expect(result).toHaveLength(2)
    })

    it('calls getList with correct doctype "Stock Status"', async () => {
        mockGetList.mockResolvedValueOnce(mockStatuses)

        await stockApi.getStockStatuses()

        expect(mockGetList).toHaveBeenCalledWith(
            'Stock Status',
            expect.objectContaining({
                fields: expect.arrayContaining(['name', 'status_name', 'status_code', 'color', 'is_sellable', 'enabled']),
            })
        )
    })
})

// ───────────────────────────────────────────────────────────────────────────
// Audit Log tests
// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getAuditLogs', () => {
    const mockLogs: StockMovementAudit[] = [
        {
            name: 'SMA-2026-00001',
            movement_date: '2026-02-19',
            movement_time: '09:00:00',
            item_code: 'ITEM-001',
            warehouse: 'Van - Ahmed',
            quantity_change: 10,
            previous_qty: 0,
            new_qty: 10,
            movement_type: 'In',
            reference_doctype: 'Stock Entry',
            reference_name: 'MAT-STE-2026-00001',
            user: 'Administrator',
            action: 'Submit',
        },
        {
            name: 'SMA-2026-00002',
            movement_date: '2026-02-19',
            movement_time: '12:00:00',
            item_code: 'ITEM-001',
            warehouse: 'Van - Ahmed',
            quantity_change: -3,
            previous_qty: 10,
            new_qty: 7,
            movement_type: 'Out',
            action: 'Submit',
        },
    ]

    it('returns audit logs sorted by date desc', async () => {
        mockGetList.mockResolvedValueOnce(mockLogs)

        const result = await stockApi.getAuditLogs()

        expect(result).toEqual(mockLogs)
        expect(result[0].movement_type).toBe('In')
    })

    it('calls getList with "Stock Movement Audit" and correct fields', async () => {
        mockGetList.mockResolvedValueOnce(mockLogs)

        await stockApi.getAuditLogs()

        expect(mockGetList).toHaveBeenCalledWith(
            'Stock Movement Audit',
            expect.objectContaining({
                fields: expect.arrayContaining([
                    'name', 'movement_date', 'movement_type',
                    'item_code', 'warehouse', 'quantity_change',
                ]),
                order_by: 'movement_date desc, movement_time desc',
                limit_page_length: 100,
            })
        )
    })

    it('accepts filter options', async () => {
        mockGetList.mockResolvedValueOnce([])

        await stockApi.getAuditLogs({ filters: [['movement_type', '=', 'In', '']] })

        expect(mockGetList).toHaveBeenCalledWith(
            'Stock Movement Audit',
            expect.objectContaining({
                filters: [['movement_type', '=', 'In', '']],
            })
        )
    })
})

// ───────────────────────────────────────────────────────────────────────────
// Transfer Request tests
// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getTransferRequests', () => {
    const mockRequests: StockTransferRequest[] = [
        {
            name: 'STR-2026-00001',
            request_date: '2026-02-18',
            from_warehouse: 'Stores - BM',
            to_warehouse: 'Van - Ahmed',
            sales_person: 'SP-Ahmed',
            status: 'Pending',
            total_quantity: 50,
        },
        {
            name: 'STR-2026-00002',
            request_date: '2026-02-17',
            from_warehouse: 'Stores - BM',
            to_warehouse: 'Van - Omar',
            sales_person: 'SP-Omar',
            status: 'Completed',
            total_quantity: 20,
        },
    ]

    it('returns transfer requests list', async () => {
        mockGetList.mockResolvedValueOnce(mockRequests)

        const result = await stockApi.getTransferRequests()

        expect(result).toHaveLength(2)
        expect(result[0].status).toBe('Pending')
        expect(result[1].status).toBe('Completed')
    })

    it('calls getList with "Stock Transfer Request"', async () => {
        mockGetList.mockResolvedValueOnce(mockRequests)

        await stockApi.getTransferRequests()

        expect(mockGetList).toHaveBeenCalledWith(
            'Stock Transfer Request',
            expect.objectContaining({
                fields: expect.arrayContaining([
                    'name', 'request_date', 'from_warehouse',
                    'to_warehouse', 'sales_person', 'status', 'total_quantity',
                ]),
                order_by: 'request_date desc',
            })
        )
    })

    it('filters by status', async () => {
        mockGetList.mockResolvedValueOnce([mockRequests[0]])

        await stockApi.getTransferRequests({ filters: [['status', '=', 'Pending', '']] })

        expect(mockGetList).toHaveBeenCalledWith(
            'Stock Transfer Request',
            expect.objectContaining({
                filters: [['status', '=', 'Pending', '']],
            })
        )
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getTransferRequest (single)', () => {
    it('returns single transfer request by name', async () => {
        const mockDoc = {
            data: {
                name: 'STR-2026-00001',
                request_date: '2026-02-18',
                from_warehouse: 'Stores - BM',
                to_warehouse: 'Van - Ahmed',
                status: 'Pending',
                total_quantity: 50,
                items: [
                    { item_code: 'ITEM-001', item_name: 'Product A', requested_qty: 50, accepted_qty: null },
                ],
            },
        }
        mockGet.mockResolvedValueOnce(mockDoc)

        const result = await stockApi.getTransferRequest('STR-2026-00001')

        expect(result).not.toBeNull()
        expect(result!.name).toBe('STR-2026-00001')
        expect(result!.items).toHaveLength(1)
        expect(mockGet).toHaveBeenCalledWith('Stock Transfer Request', 'STR-2026-00001')
    })

    it('returns null when document not found', async () => {
        mockGet.mockResolvedValueOnce({ data: undefined })

        const result = await stockApi.getTransferRequest('NONEXISTENT')

        expect(result).toBeNull()
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.acceptTransferRequest', () => {
    it('calls the correct whitelisted API method', async () => {
        mockCall.mockResolvedValueOnce({ message: { status: 'success', stock_entry: 'MAT-STE-2026-00001' } })

        const result = await stockApi.acceptTransferRequest('STR-2026-00001')

        expect(mockCall).toHaveBeenCalledWith(
            'base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.accept_transfer_request',
            { request_name: 'STR-2026-00001' }
        )
        expect(result.message.status).toBe('success')
        expect(result.message.stock_entry).toBe('MAT-STE-2026-00001')
    })

    it('sends accepted_items when provided', async () => {
        mockCall.mockResolvedValueOnce({ message: { status: 'success', stock_entry: 'MAT-STE-2026-00002' } })

        const items = [{ item_code: 'ITEM-001', accepted_qty: 40 }]
        await stockApi.acceptTransferRequest('STR-2026-00001', items)

        expect(mockCall).toHaveBeenCalledWith(
            expect.stringContaining('accept_transfer_request'),
            {
                request_name: 'STR-2026-00001',
                accepted_items: JSON.stringify(items),
            }
        )
    })

    it('throws error when request is already accepted', async () => {
        mockCall.mockRejectedValueOnce(new Error('Only pending requests can be accepted'))

        await expect(
            stockApi.acceptTransferRequest('STR-2026-00002')
        ).rejects.toThrow('Only pending requests can be accepted')
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.rejectTransferRequest', () => {
    it('calls the correct method with rejection reason', async () => {
        mockCall.mockResolvedValueOnce({ message: { status: 'rejected' } })

        await stockApi.rejectTransferRequest('STR-2026-00001', 'Out of stock')

        expect(mockCall).toHaveBeenCalledWith(
            'base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.reject_transfer_request',
            { request_name: 'STR-2026-00001', rejection_reason: 'Out of stock' }
        )
    })

    it('throws when no rejection reason is given', async () => {
        mockCall.mockRejectedValueOnce(new Error('Please provide a rejection reason'))

        await expect(
            stockApi.rejectTransferRequest('STR-2026-00001', '')
        ).rejects.toThrow('Please provide a rejection reason')
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getPendingTransferRequests', () => {
    const mockPending: StockTransferRequest[] = [
        { name: 'STR-2026-00001', request_date: '2026-02-18', from_warehouse: 'Stores - BM', to_warehouse: 'Van - Ahmed', status: 'Pending', total_quantity: 50 },
    ]

    it('returns pending requests for all sales persons when no arg', async () => {
        mockCall.mockResolvedValueOnce({ message: mockPending })

        const result = await stockApi.getPendingTransferRequests()

        expect(result).toHaveLength(1)
        expect(mockCall).toHaveBeenCalledWith(
            expect.stringContaining('get_pending_requests_for_sales_person'),
            {}
        )
    })

    it('passes sales_person filter when provided', async () => {
        mockCall.mockResolvedValueOnce({ message: mockPending })

        await stockApi.getPendingTransferRequests('SP-Ahmed')

        expect(mockCall).toHaveBeenCalledWith(
            expect.stringContaining('get_pending_requests_for_sales_person'),
            { sales_person: 'SP-Ahmed' }
        )
    })

    it('returns empty array when message is undefined', async () => {
        mockCall.mockResolvedValueOnce({ message: undefined })

        const result = await stockApi.getPendingTransferRequests()

        expect(result).toEqual([])
    })
})

// ───────────────────────────────────────────────────────────────────────────
// Return Log tests
// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getReturnLogs', () => {
    const mockLogs: ReturnLog[] = [
        {
            name: 'RET-2026-00001',
            return_date: '2026-02-15',
            warehouse: 'Stores - BM',
            sales_person: 'SP-Ahmed',
            customer: 'Customer A',
            return_reason: 'Damaged',
            total_quantity: 3,
            total_value: 150,
            status: 'Submitted',
        },
    ]

    it('returns list of return logs', async () => {
        mockGetList.mockResolvedValueOnce(mockLogs)

        const result = await stockApi.getReturnLogs()

        expect(result).toHaveLength(1)
        expect(result[0].return_reason).toBe('Damaged')
    })

    it('calls getList with "Return Log" and correct fields', async () => {
        mockGetList.mockResolvedValueOnce(mockLogs)

        await stockApi.getReturnLogs()

        expect(mockGetList).toHaveBeenCalledWith(
            'Return Log',
            expect.objectContaining({
                fields: expect.arrayContaining([
                    'name', 'return_date', 'warehouse',
                    'sales_person', 'customer', 'return_reason',
                    'total_quantity', 'total_value', 'status',
                ]),
                order_by: 'return_date desc',
            })
        )
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getReturnLog (single)', () => {
    it('returns single return log with items', async () => {
        const mockDoc = {
            data: {
                name: 'RET-2026-00001',
                return_date: '2026-02-15',
                warehouse: 'Stores - BM',
                status: 'Submitted',
                items: [
                    { item_code: 'ITEM-001', item_name: 'Product A', quantity: 3, rate: 50, amount: 150 },
                ],
            },
        }
        mockGet.mockResolvedValueOnce(mockDoc)

        const result = await stockApi.getReturnLog('RET-2026-00001')

        expect(result).not.toBeNull()
        expect(result!.items).toHaveLength(1)
        expect(result!.items![0].quantity).toBe(3)
    })

    it('returns null when not found', async () => {
        mockGet.mockResolvedValueOnce({ data: undefined })

        const result = await stockApi.getReturnLog('NONEXISTENT')

        expect(result).toBeNull()
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getInvoiceItemsForReturn', () => {
    it('returns items of a Sales Invoice', async () => {
        const mockItems = [
            { item_code: 'ITEM-001', item_name: 'Product A', qty: 5, rate: 100, uom: 'Nos' },
            { item_code: 'ITEM-002', item_name: 'Product B', qty: 2, rate: 200, uom: 'Nos' },
        ]
        mockCall.mockResolvedValueOnce({ message: mockItems })

        const result = await stockApi.getInvoiceItemsForReturn('ACC-SINV-2026-00001')

        expect(result).toHaveLength(2)
        expect(result[0].item_code).toBe('ITEM-001')
        expect(mockCall).toHaveBeenCalledWith(
            'base_meena.stock_management.doctype.return_log.return_log.get_invoice_items',
            { sales_invoice: 'ACC-SINV-2026-00001' }
        )
    })

    it('returns empty array when invoice has no items', async () => {
        mockCall.mockResolvedValueOnce({ message: undefined })

        const result = await stockApi.getInvoiceItemsForReturn('ACC-SINV-2026-99999')

        expect(result).toEqual([])
    })
})

// ───────────────────────────────────────────────────────────────────────────
// Sales Person stock tests
// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getSalesPersonStock', () => {
    const mockStock: BinStock[] = [
        { item_code: 'ITEM-001', item_name: 'Product A', warehouse: 'Van - Ahmed', actual_qty: 10, stock_uom: 'Nos', valuation_rate: 50, stock_value: 500 },
        { item_code: 'ITEM-002', item_name: 'Product B', warehouse: 'Van - Ahmed', actual_qty: 3, stock_uom: 'Box', valuation_rate: 100, stock_value: 300 },
    ]

    it('returns stock items for a sales person', async () => {
        mockCall.mockResolvedValueOnce({ message: mockStock })

        const result = await stockApi.getSalesPersonStock('SP-Ahmed')

        expect(result).toHaveLength(2)
        expect(result[0].actual_qty).toBe(10)
    })

    it('calls the correct method with sales_person arg', async () => {
        mockCall.mockResolvedValueOnce({ message: mockStock })

        await stockApi.getSalesPersonStock('SP-Ahmed')

        expect(mockCall).toHaveBeenCalledWith(
            'base_meena.stock_management.stock_validation.get_salesperson_stock',
            { sales_person: 'SP-Ahmed' }
        )
    })

    it('returns empty array when sales person has no stock', async () => {
        mockCall.mockResolvedValueOnce({ message: [] })

        const result = await stockApi.getSalesPersonStock('SP-Empty')

        expect(result).toEqual([])
    })
})

// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.checkItemAvailability', () => {
    it('returns availability status when item is available', async () => {
        const mockResult = {
            item_code: 'ITEM-001',
            warehouse: 'Van - Ahmed',
            requested_qty: 5,
            available_qty: 10,
            is_available: true,
            shortage: 0,
        }
        mockCall.mockResolvedValueOnce({ message: mockResult })

        const result = await stockApi.checkItemAvailability('ITEM-001', 'Van - Ahmed', 5)

        expect(result.is_available).toBe(true)
        expect(result.available_qty).toBe(10)
        expect(result.shortage).toBe(0)
    })

    it('returns shortage when item is not available', async () => {
        const mockResult = {
            item_code: 'ITEM-001',
            warehouse: 'Van - Ahmed',
            requested_qty: 20,
            available_qty: 3,
            is_available: false,
            shortage: 17,
        }
        mockCall.mockResolvedValueOnce({ message: mockResult })

        const result = await stockApi.checkItemAvailability('ITEM-001', 'Van - Ahmed', 20)

        expect(result.is_available).toBe(false)
        expect(result.shortage).toBe(17)
    })

    it('includes batch_no when provided', async () => {
        mockCall.mockResolvedValueOnce({ message: { item_code: 'ITEM-001', warehouse: 'Van - Ahmed', requested_qty: 5, available_qty: 5, is_available: true, shortage: 0 } })

        await stockApi.checkItemAvailability('ITEM-001', 'Van - Ahmed', 5, 'BATCH-001')

        expect(mockCall).toHaveBeenCalledWith(
            'base_meena.stock_management.stock_validation.check_item_availability',
            { item_code: 'ITEM-001', warehouse: 'Van - Ahmed', qty: 5, batch_no: 'BATCH-001' }
        )
    })

    it('does NOT include batch_no when not provided', async () => {
        mockCall.mockResolvedValueOnce({ message: { item_code: 'ITEM-001', warehouse: 'Van - Ahmed', requested_qty: 5, available_qty: 5, is_available: true, shortage: 0 } })

        await stockApi.checkItemAvailability('ITEM-001', 'Van - Ahmed', 5)

        expect(mockCall).toHaveBeenCalledWith(
            expect.any(String),
            expect.not.objectContaining({ batch_no: expect.anything() })
        )
    })
})

// ───────────────────────────────────────────────────────────────────────────
// Bin Stock tests
// ───────────────────────────────────────────────────────────────────────────

describe('stockApi.getBinStock', () => {
    const mockBins: BinStock[] = [
        { item_code: 'ITEM-001', warehouse: 'Stores - BM', actual_qty: 100, stock_uom: 'Nos', valuation_rate: 50, stock_value: 5000 },
        { item_code: 'ITEM-002', warehouse: 'Van - Ahmed', actual_qty: 10, stock_uom: 'Box', valuation_rate: 200, stock_value: 2000 },
    ]

    it('returns all bin stock without warehouse filter', async () => {
        mockGetList.mockResolvedValueOnce(mockBins)

        const result = await stockApi.getBinStock()

        expect(result).toHaveLength(2)
        expect(mockGetList).toHaveBeenCalledWith(
            'Bin',
            expect.objectContaining({
// actual_qty > 0 is filtered in-memory, not in the API call
                filters: [],
                fields: expect.arrayContaining(['item_code', 'warehouse', 'actual_qty']),
            })
        )
    })

    it('adds warehouse filter when warehouse is provided', async () => {
        mockGetList.mockResolvedValueOnce([mockBins[1]])

        const result = await stockApi.getBinStock('Van - Ahmed')

        expect(result).toHaveLength(1)
        expect(result[0].warehouse).toBe('Van - Ahmed')
        expect(mockGetList).toHaveBeenCalledWith(
            'Bin',
            expect.objectContaining({
                // only warehouse filter is pushed; actual_qty is filtered in-memory
                filters: expect.arrayContaining([
                    ['Bin', 'warehouse', '=', 'Van - Ahmed'],
                ]),
            })
        )
    })

    it('returns empty array when warehouse has no stock', async () => {
        mockGetList.mockResolvedValueOnce([])

        const result = await stockApi.getBinStock('Empty Warehouse')

        expect(result).toEqual([])
    })
})

// ───────────────────────────────────────────────────────────────────────────
// Edge case & error handling
// ───────────────────────────────────────────────────────────────────────────

describe('Error handling across all methods', () => {
    const methods = [
        { name: 'getWarehouses', call: () => stockApi.getWarehouses(), mock: 'getList' },
        { name: 'getVanWarehouses', call: () => stockApi.getVanWarehouses(), mock: 'getList' },
        { name: 'getStockStatuses', call: () => stockApi.getStockStatuses(), mock: 'getList' },
        { name: 'getAuditLogs', call: () => stockApi.getAuditLogs(), mock: 'getList' },
        { name: 'getTransferRequests', call: () => stockApi.getTransferRequests(), mock: 'getList' },
        { name: 'getReturnLogs', call: () => stockApi.getReturnLogs(), mock: 'getList' },
    ] as const

    it.each(methods)('$name propagates network error', async ({ call, mock }) => {
        if (mock === 'getList') {
            mockGetList.mockRejectedValue(new Error('Frappe server unreachable'))
        } else {
            mockGet.mockRejectedValue(new Error('Frappe server unreachable'))
        }

        await expect(call()).rejects.toThrow('Frappe server unreachable')
    })

    // getBinStock has a try-catch fallback that makes a second getList call;
    // both calls must reject for the error to propagate
    it('getBinStock propagates network error', async () => {
        mockGetList
            .mockRejectedValueOnce(new Error('Frappe server unreachable'))
            .mockRejectedValueOnce(new Error('Frappe server unreachable'))
        await expect(stockApi.getBinStock()).rejects.toThrow('Frappe server unreachable')
    })
})
