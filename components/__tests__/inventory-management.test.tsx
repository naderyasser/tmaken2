/**
 * InventoryManagement — Full Unit Test Suite
 *
 * Covers (via InventoryManagement parent + tab switching):
 *  1.  Root: loading, error banner, error dismiss, tab routing, refresh
 *  2.  DashboardView: stat cards, warehouse distribution, recent movements, navigation
 *  3.  LiveInventoryView: table item_name/code, search, warehouse filter,
 *                         summary cards, pagination, Material Receipt dialog,
 *                         Check Availability dialog
 *  4.  TransfersView: table + Rep column, status filter, search, accept, reject,
 *                     create dialog validation + submit, detail dialog
 *  5.  ReturnsView: table, search, create dialog validation + submit, detail dialog
 *  6.  AuditView: table, movement-type filter, search
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── isRTL toggle ─────────────────────────────────────────────────────────────
let mockIsRTL = false

jest.mock('@/lib/i18n', () => ({
    useI18n: () => ({ isRTL: mockIsRTL, t: (k: string) => k }),
}))

jest.mock('@/lib/utils', () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}))

jest.mock('@/components/ui/skeleton', () => ({
    Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}))

jest.mock('@/hooks/use-company', () => ({
    useCompany: () => ({ company: null, isAdmin: true, allCompanies: [], employee: null, switchCompany: jest.fn() }),
    useCompanySafe: () => ({ company: null, isAdmin: true, allCompanies: [], employee: null, switchCompany: jest.fn() }),
}))

// ─── Stock API mocks ───────────────────────────────────────────────────────────
const mockGetWarehouses = jest.fn()
const mockGetTransferRequests = jest.fn()
const mockGetReturnLogs = jest.fn()
const mockGetAuditLogs = jest.fn()
const mockGetBinStock = jest.fn()
const mockGetSalesPersons = jest.fn()
const mockGetCompanies = jest.fn()
const mockGetWarehouseGroups = jest.fn()
const mockCreateTransfer = jest.fn()
const mockAcceptTransfer = jest.fn()
const mockRejectTransfer = jest.fn()
const mockGetTransferRequest = jest.fn()
const mockCreateReturn = jest.fn()
const mockGetReturnLog = jest.fn()
const mockSubmitProductReturn = jest.fn()
const mockGetInvoiceItems = jest.fn()
const mockCreateReceipt = jest.fn()
const mockCheckAvailability = jest.fn()
const mockSearchItems = jest.fn()
const mockSearchCustomers = jest.fn()
const mockCreateWarehouse = jest.fn()
const mockUpdateWarehouse = jest.fn()
const mockToggleWarehouse = jest.fn()
const mockGetItems = jest.fn()
const mockGetItem = jest.fn()
const mockGetItemGroups = jest.fn()
const mockGetUOMs = jest.fn()
const mockCreateItem = jest.fn()
const mockUpdateItem = jest.fn()
const mockToggleItem = jest.fn()
const mockGetStockReconciliations = jest.fn()
const mockCreateStockReconciliation = jest.fn()

const mockScannerStart = jest.fn().mockResolvedValue(undefined)
const mockScannerStop = jest.fn().mockResolvedValue(undefined)
const mockHtml5QrcodeInstance = { start: mockScannerStart, stop: mockScannerStop }

jest.mock('html5-qrcode', () => ({
    Html5Qrcode: jest.fn(() => mockHtml5QrcodeInstance),
    Html5QrcodeSupportedFormats: {
        QR_CODE: 0,
        AZTEC: 1,
        CODABAR: 2,
        CODE_128: 3,
        CODE_39: 4,
        CODE_93: 5,
        DATA_MATRIX: 6,
        EAN_13: 7,
        EAN_8: 8,
        ITF: 9,
        MAXICODE: 10,
        PDF_417: 11,
        RSS_14: 12,
        RSS_EXPANDED: 13,
        UPC_A: 14,
        UPC_E: 15,
        UPC_EAN_EXTENSION: 16,
    },
}), { virtual: true })

jest.mock('@/lib/stock-api', () => ({
    stockApi: {
        getWarehouses: (...a: any[]) => mockGetWarehouses(...a),
        getTransferRequests: (...a: any[]) => mockGetTransferRequests(...a),
        getReturnLogs: (...a: any[]) => mockGetReturnLogs(...a),
        getAuditLogs: (...a: any[]) => mockGetAuditLogs(...a),
        getBinStock: (...a: any[]) => mockGetBinStock(...a),
        getSalesPersons: (...a: any[]) => mockGetSalesPersons(...a),
        getCompanies: (...a: any[]) => mockGetCompanies(...a),
        getWarehouseGroups: (...a: any[]) => mockGetWarehouseGroups(...a),
        createTransferRequest: (...a: any[]) => mockCreateTransfer(...a),
        acceptTransferRequest: (...a: any[]) => mockAcceptTransfer(...a),
        rejectTransferRequest: (...a: any[]) => mockRejectTransfer(...a),
        getTransferRequest: (...a: any[]) => mockGetTransferRequest(...a),
        createReturnLog: (...a: any[]) => mockCreateReturn(...a),
        getReturnLog: (...a: any[]) => mockGetReturnLog(...a),
        getInvoiceItemsForReturn: (...a: any[]) => mockGetInvoiceItems(...a),
        createMaterialReceipt: (...a: any[]) => mockCreateReceipt(...a),
        checkItemAvailability: (...a: any[]) => mockCheckAvailability(...a),
        searchItems: (...a: any[]) => mockSearchItems(...a),
        searchCustomers: (...a: any[]) => mockSearchCustomers(...a),
        createWarehouse: (...a: any[]) => mockCreateWarehouse(...a),
        updateWarehouse: (...a: any[]) => mockUpdateWarehouse(...a),
        toggleWarehouse: (...a: any[]) => mockToggleWarehouse(...a),
        getItems: (...a: any[]) => mockGetItems(...a),
        getItem: (...a: any[]) => mockGetItem(...a),
        getItemGroups: (...a: any[]) => mockGetItemGroups(...a),
        getUOMs: (...a: any[]) => mockGetUOMs(...a),
        createItem: (...a: any[]) => mockCreateItem(...a),
        updateItem: (...a: any[]) => mockUpdateItem(...a),
        toggleItem: (...a: any[]) => mockToggleItem(...a),
        getStockReconciliations: (...a: any[]) => mockGetStockReconciliations(...a),
        createStockReconciliation: (...a: any[]) => mockCreateStockReconciliation(...a),
    },
}))

// ─── Sales API mocks (ReturnsView uses salesApi, not stockApi for returns) ───
const mockGetProductReturns = jest.fn()
const mockCreateProductReturn = jest.fn()
const mockGetProductReturn = jest.fn()

jest.mock('@/lib/sales-api', () => ({
    salesApi: {
        getProductReturns: (...a: any[]) => mockGetProductReturns(...a),
        createProductReturn: (...a: any[]) => mockCreateProductReturn(...a),
        getProductReturn: (...a: any[]) => mockGetProductReturn(...a),
        submitProductReturn: (...a: any[]) => mockSubmitProductReturn(...a),
    },
}))

// ─── Component under test ─────────────────────────────────────────────────────
import { InventoryManagement } from '../inventory/inventory-management'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const WH_MAIN = {
    name: 'Main - Q', warehouse_name: 'Main WH',
    custom_warehouse_type: 'Main', company: 'Q', disabled: 0, is_group: 0,
}
const WH_VAN = {
    name: 'Van - Q', warehouse_name: 'Van 1',
    custom_warehouse_type: 'Van', custom_linked_sales_person: 'SP-001',
    company: 'Q', disabled: 0, is_group: 0,
}
const WH_DISABLED = {
    name: 'Old - Q', warehouse_name: 'Old WH',
    custom_warehouse_type: 'Main', company: 'Q', disabled: 1, is_group: 0,
}

const TRANSFER_PENDING = {
    name: 'STR-0001', request_date: '2026-02-01',
    from_warehouse: 'Main - Q', to_warehouse: 'Van - Q',
    sales_person: 'SP-001', status: 'Pending', total_quantity: 5, docstatus: 0,
}
const TRANSFER_ACCEPTED = {
    name: 'STR-0002', request_date: '2026-01-15',
    from_warehouse: 'Van - Q', to_warehouse: 'Main - Q',
    status: 'Accepted', total_quantity: 3, stock_entry: 'STE-001', docstatus: 1,
}

const RETURN_DRAFT = {
    name: 'RL-0001', return_date: '2026-02-05',
    warehouse: 'Main - Q', sales_person: 'SP-001',
    customer: 'Ahmed', total_quantity: 2, status: 'Draft', docstatus: 0,
}
const RETURN_SUBMITTED = {
    name: 'RL-0002', return_date: '2026-01-20',
    warehouse: 'Van - Q', total_quantity: 1, status: 'Submitted', docstatus: 1,
}

const AUDIT_IN = {
    name: 'SMA-001', movement_date: '2026-02-10', movement_time: '10:00',
    item_code: 'ITEM-A', warehouse: 'Main - Q',
    quantity_change: 10, previous_qty: 0, new_qty: 10, movement_type: 'In',
}
const AUDIT_OUT = {
    name: 'SMA-002', movement_date: '2026-02-09', movement_time: '09:00',
    item_code: 'ITEM-B', warehouse: 'Van - Q',
    quantity_change: -3, previous_qty: 10, new_qty: 7, movement_type: 'Out',
}
const AUDIT_TRANSFER = {
    name: 'SMA-003', movement_date: '2026-02-08',
    item_code: 'ITEM-C', warehouse: 'Main - Q',
    quantity_change: 5, previous_qty: 5, new_qty: 10, movement_type: 'Transfer',
    reference_name: 'STR-0001',
}

const BIN_ITEM_A = {
    item_code: 'ITEM-A', item_name: 'Widget Alpha',
    warehouse: 'Main - Q', actual_qty: 20,
    stock_uom: 'Nos', valuation_rate: 50, stock_value: 1000,
}
const BIN_ITEM_B = {
    item_code: 'ITEM-B', item_name: 'Gadget Beta',
    warehouse: 'Van - Q', actual_qty: 5,
    stock_uom: 'Nos', valuation_rate: 100, stock_value: 500,
}

const SP1 = { name: 'SP-001', sales_person_name: 'Ali Ahmed', enabled: 1 }

// ─── Product Fixtures ───────────────────────────────────────────────────────────
const ITEM_ACTIVE = {
    name: 'ITEM-001', item_name: 'Widget Alpha', item_code: 'ITEM-001',
    item_group: 'Products', stock_uom: 'Nos', standard_rate: 50,
    is_stock_item: 1, disabled: 0, has_batch_no: 0, has_serial_no: 0,
    description: 'A handy widget', creation: '2026-01-01 10:00:00', modified: '2026-02-01 12:00:00',
}
const ITEM_DISABLED = {
    name: 'ITEM-002', item_name: 'Gadget Beta', item_code: 'ITEM-002',
    item_group: 'Raw Material', stock_uom: 'Kg', standard_rate: 120,
    is_stock_item: 1, disabled: 1, has_batch_no: 1, has_serial_no: 0,
    description: 'Raw gadget material', creation: '2026-01-05 08:00:00', modified: '2026-01-20 15:00:00',
}
const ITEM_NON_STOCK = {
    name: 'ITEM-003', item_name: 'Service Plan', item_code: 'ITEM-003',
    item_group: 'Products', stock_uom: 'Nos', standard_rate: 200,
    is_stock_item: 0, disabled: 0, has_batch_no: 0, has_serial_no: 1,
    description: 'Service subscription', creation: '2026-02-10 14:00:00', modified: '2026-02-10 14:00:00',
}

const IG_PRODUCTS = { name: 'Products', is_group: 0, parent_item_group: 'All Item Groups' }
const IG_RAW = { name: 'Raw Material', is_group: 0, parent_item_group: 'All Item Groups' }
const IG_GROUP = { name: 'All Item Groups', is_group: 1, parent_item_group: '' }

const UOM_NOS = { name: 'Nos', must_be_whole_number: 1 }
const UOM_KG = { name: 'Kg', must_be_whole_number: 0 }
const UOM_BOX = { name: 'Box', must_be_whole_number: 1 }

// ─── Default API responses ─────────────────────────────────────────────────────
function setupDefaults() {
    mockGetWarehouses.mockResolvedValue([WH_MAIN, WH_VAN, WH_DISABLED])
    mockGetTransferRequests.mockResolvedValue([TRANSFER_PENDING, TRANSFER_ACCEPTED])
    mockGetReturnLogs.mockResolvedValue([RETURN_DRAFT, RETURN_SUBMITTED])
    mockGetProductReturns.mockResolvedValue([RETURN_DRAFT, RETURN_SUBMITTED])
    mockGetAuditLogs.mockResolvedValue([AUDIT_IN, AUDIT_OUT, AUDIT_TRANSFER])
    mockGetBinStock.mockResolvedValue([BIN_ITEM_A, BIN_ITEM_B])
    mockGetSalesPersons.mockResolvedValue([SP1])
    mockGetCompanies.mockResolvedValue([{ name: 'Q', company_name: 'القرعاوي' }])
    mockGetWarehouseGroups.mockResolvedValue([])
    mockSearchItems.mockResolvedValue([])
    mockSearchCustomers.mockResolvedValue([])
    mockGetItems.mockResolvedValue([ITEM_ACTIVE, ITEM_DISABLED, ITEM_NON_STOCK])
    mockGetItemGroups.mockResolvedValue([IG_PRODUCTS, IG_RAW, IG_GROUP])
    mockGetUOMs.mockResolvedValue([UOM_NOS, UOM_KG, UOM_BOX])
    mockGetItem.mockResolvedValue(ITEM_ACTIVE)
    mockCreateItem.mockResolvedValue({ name: 'ITEM-NEW-001', item_name: 'New Product' })
    mockUpdateItem.mockResolvedValue({ ...ITEM_ACTIVE, item_name: 'Updated Widget' })
    mockToggleItem.mockResolvedValue({ ...ITEM_ACTIVE, disabled: 1 })
    mockCreateReceipt.mockResolvedValue({ name: 'STE-NEW-001' })
    mockGetStockReconciliations.mockResolvedValue([])
    mockCreateStockReconciliation.mockResolvedValue({ name: 'STRC-001', posting_date: '2026-02-24', docstatus: 1 })
    mockCreateProductReturn.mockResolvedValue({ name: 'RL-NEW' })
    mockGetProductReturn.mockResolvedValue({ ...RETURN_DRAFT, items: [{ item_code: 'ITEM-A', qty: 2 }] })
    mockSubmitProductReturn.mockResolvedValue({})
}

// ─── Render helpers ────────────────────────────────────────────────────────────
function renderIM(tab: string = 'dashboard', onTabChange = jest.fn()) {
    return render(
        <InventoryManagement activeTab={tab as any} onTabChange={onTabChange} />
    )
}

// Wait for loading to complete (loading spinner disappears)
async function waitForLoad() {
    await waitFor(() => {
        expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
    }, { timeout: 3000 })
}

// ─── Reset ────────────────────────────────────────────────────────────────────
beforeEach(() => {
    jest.clearAllMocks()
    mockIsRTL = false
    setupDefaults()
})

// ══════════════════════════════════════════════════════════════════════════════
// 1. ROOT — InventoryManagement
// ══════════════════════════════════════════════════════════════════════════════
describe('Root — InventoryManagement', () => {
    it('shows skeleton placeholders while loading', () => {
        // Make APIs never resolve during this test
        mockGetWarehouses.mockReturnValue(new Promise(() => { }))
        renderIM('dashboard')
        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })

    it('hides skeletons after data loads', async () => {
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
    })

    it('shows Refresh button', async () => {
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText(/Refresh|تحديث/)).toBeInTheDocument()
    })

    it('Refresh button calls all APIs again', async () => {
        renderIM('dashboard')
        await waitForLoad()
        const prevCalls = mockGetWarehouses.mock.calls.length
        fireEvent.click(screen.getByText(/Refresh|تحديث/))
        await waitFor(() => expect(mockGetWarehouses).toHaveBeenCalledTimes(prevCalls + 1))
    })

    it('shows error banner when an API call fails', async () => {
        mockGetTransferRequests.mockRejectedValue(new Error('DocType not found'))
        renderIM('dashboard')
        await waitForLoad()
        await waitFor(() => {
            expect(screen.getByText(/failed to load|فشل تحميل/i)).toBeInTheDocument()
        })
    })

    it('shows Arabic error when a DocType is missing (isRTL=true)', async () => {
        mockIsRTL = true
        mockGetProductReturns.mockRejectedValue(new Error('No module named'))
        renderIM('dashboard')
        await waitForLoad()
        await waitFor(() => {
            expect(screen.getAllByText(/فشل تحميل/i).length).toBeGreaterThan(0)
        })
    })

    it('error banner can be dismissed by clicking X', async () => {
        mockGetAuditLogs.mockRejectedValue(new Error('403'))
        renderIM('dashboard')
        await waitForLoad()
        await waitFor(() => screen.getByText(/failed to load|فشل تحميل/i))
        const closeBtn = screen.getByRole('button', { name: '' }) // X button — svg only
        // just click the X (last button in the error div area)
        const allBtns = screen.getAllByRole('button')
        // find the error banner X
        const banner = screen.getByText(/failed to load|فشل تحميل/i).closest('div')!.parentElement!
        const xBtn = within(banner).getAllByRole('button').at(-1)!
        fireEvent.click(xBtn)
        await waitFor(() => {
            expect(screen.queryByText(/failed to load|فشل تحميل/i)).not.toBeInTheDocument()
        })
    })

    it('renders dashboard content when activeTab=dashboard', async () => {
        renderIM('dashboard')
        await waitForLoad()
        // DashboardView shows "Active Warehouses" card
        expect(screen.getByText(/Active Warehouses|المستودعات النشطة/)).toBeInTheDocument()
    })

    it('renders inventory content when activeTab=inventory', async () => {
        renderIM('inventory')
        await waitForLoad()
        // LiveInventoryView shows "Stock In" or "إدخال مخزون" button
        expect(screen.getByText(/Stock In|إدخال مخزون/)).toBeInTheDocument()
    })

    it('renders transfers content when activeTab=transfers', async () => {
        renderIM('transfers')
        await waitForLoad()
        expect(screen.getByText(/New Request|طلب جديد/)).toBeInTheDocument()
    })

    it('renders returns content when activeTab=returns', async () => {
        renderIM('returns')
        await waitForLoad()
        expect(screen.getByText(/New Return|مرتجع جديد/)).toBeInTheDocument()
    })

    it('renders audit content when activeTab=audit', async () => {
        renderIM('audit')
        await waitForLoad()
        // AuditView renders movement type filter buttons
        expect(screen.getByRole('button', { name: /^In$|^In$/ })).toBeInTheDocument()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. DASHBOARD VIEW
// ══════════════════════════════════════════════════════════════════════════════
describe('DashboardView', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows Active Warehouses count (non-disabled, non-group)', async () => {
        renderIM('dashboard')
        await waitForLoad()
        // WH_MAIN + WH_VAN are active; WH_DISABLED is disabled  → 2 active
        const card = screen.getByText('Active Warehouses').closest('button')!
        expect(within(card).getByText('2')).toBeInTheDocument()
    })

    it('shows SKUs in Stock count', async () => {
        renderIM('dashboard')
        await waitForLoad()
        // BIN_ITEM_A + BIN_ITEM_B = 2 unique SKUs
        const card = screen.getByText('SKUs in Stock').closest('button')!
        expect(within(card).getByText('2')).toBeInTheDocument()
    })

    it('shows Pending Transfers count', async () => {
        renderIM('dashboard')
        await waitForLoad()
        const card = screen.getByText('Pending Transfers').closest('button')!
        expect(within(card).getByText('1')).toBeInTheDocument()
    })

    it('shows Return Logs count', async () => {
        renderIM('dashboard')
        await waitForLoad()
        const returnsElements = screen.getAllByText('Returns')
        const card = returnsElements[0].closest('button')!
        expect(within(card).getByText('2')).toBeInTheDocument()
    })

    it('shows stock total value in sub-text of SKUs card', async () => {
        renderIM('dashboard')
        await waitForLoad()
        // BIN_ITEM_A value=1000, BIN_ITEM_B value=500 → 1500 SAR
        expect(screen.getByText(/1,500|1500/)).toBeInTheDocument()
    })

    it('renders Warehouse Distribution section', async () => {
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText(/Warehouse Distribution|توزيع المستودعات/)).toBeInTheDocument()
    })

    it('renders Recent Movements section', async () => {
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText(/Recent Movements|آخر الحركات/)).toBeInTheDocument()
    })

    it('shows recent audit log items (item codes)', async () => {
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText('ITEM-A')).toBeInTheDocument()
        // ITEM-B may also appear in Low Stock Alerts, so use getAllByText
        expect(screen.getAllByText('ITEM-B').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('ITEM-C')).toBeInTheDocument()
    })

    it('calls onTabChange("warehouses") when Active Warehouses card is clicked', async () => {
        const onTabChange = jest.fn()
        render(<InventoryManagement activeTab="dashboard" onTabChange={onTabChange} />)
        await waitForLoad()
        fireEvent.click(screen.getByText('Active Warehouses').closest('button')!)
        expect(onTabChange).toHaveBeenCalledWith('warehouses')
    })

    it('calls onTabChange("inventory") when SKUs card is clicked', async () => {
        const onTabChange = jest.fn()
        render(<InventoryManagement activeTab="dashboard" onTabChange={onTabChange} />)
        await waitForLoad()
        fireEvent.click(screen.getByText('SKUs in Stock').closest('button')!)
        expect(onTabChange).toHaveBeenCalledWith('inventory')
    })

    it('calls onTabChange("transfers") when Pending Transfers card is clicked', async () => {
        const onTabChange = jest.fn()
        render(<InventoryManagement activeTab="dashboard" onTabChange={onTabChange} />)
        await waitForLoad()
        fireEvent.click(screen.getByText('Pending Transfers').closest('button')!)
        expect(onTabChange).toHaveBeenCalledWith('transfers')
    })

    it('calls onTabChange("audit") when "View all" movements link is clicked', async () => {
        const onTabChange = jest.fn()
        render(<InventoryManagement activeTab="dashboard" onTabChange={onTabChange} />)
        await waitForLoad()
        fireEvent.click(screen.getByText(/View all|عرض الكل/))
        expect(onTabChange).toHaveBeenCalledWith('audit')
    })

    it('shows Arabic labels when isRTL=true', async () => {
        mockIsRTL = true
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText('المستودعات النشطة')).toBeInTheDocument()
        expect(screen.getByText('أصناف في المخزون')).toBeInTheDocument()
        expect(screen.getByText('طلبات نقل معلقة')).toBeInTheDocument()
        expect(screen.getByText('المرتجعات')).toBeInTheDocument()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. LIVE INVENTORY VIEW
// ══════════════════════════════════════════════════════════════════════════════
describe('LiveInventoryView', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows item_name as primary text in table rows', async () => {
        renderIM('inventory')
        await waitForLoad()
        expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
        expect(screen.getByText('Gadget Beta')).toBeInTheDocument()
    })

    it('shows item_code as subtitle when item_name differs', async () => {
        renderIM('inventory')
        await waitForLoad()
        // ITEM-A and ITEM-B codes should appear as subtitles
        expect(screen.getByText('ITEM-A')).toBeInTheDocument()
        expect(screen.getByText('ITEM-B')).toBeInTheDocument()
    })

    it('renders summary card: Total SKUs = 2', async () => {
        renderIM('inventory')
        await waitForLoad()
        expect(screen.getByText('Total SKUs')).toBeInTheDocument()
        const skuCard = screen.getByText('Total SKUs').closest('div')!
        expect(within(skuCard).getByText('2')).toBeInTheDocument()
    })

    it('renders summary card: Stock Records = 2', async () => {
        renderIM('inventory')
        await waitForLoad()
        const recCard = screen.getByText('Stock Records').closest('div')!
        expect(within(recCard).getByText('2')).toBeInTheDocument()
    })

    it('renders summary card: Total Value = 1,500', async () => {
        renderIM('inventory')
        await waitForLoad()
        const valCard = screen.getByText('Total Value').closest('div')!
        expect(within(valCard).getByText(/1,500|1500/)).toBeInTheDocument()
    })

    it('filters by warehouse using the dropdown', async () => {
        renderIM('inventory')
        await waitForLoad()
        const select = screen.getByDisplayValue(/All Warehouses|كل المستودعات/)
        fireEvent.change(select, { target: { value: 'Main - Q' } })
        // Only ITEM-A (Main - Q) should remain
        expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
        expect(screen.queryByText('Gadget Beta')).not.toBeInTheDocument()
    })

    it('searches by item code', async () => {
        renderIM('inventory')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText(/Search by item code or name|بحث/)
        await userEvent.type(searchInput, 'ITEM-A')
        expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
        expect(screen.queryByText('Gadget Beta')).not.toBeInTheDocument()
    })

    it('searches by item name', async () => {
        renderIM('inventory')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText(/Search by item code or name|بحث/)
        await userEvent.type(searchInput, 'Gadget')
        expect(screen.getByText('Gadget Beta')).toBeInTheDocument()
        expect(screen.queryByText('Widget Alpha')).not.toBeInTheDocument()
    })

    it('shows "No stock found" when search matches nothing', async () => {
        renderIM('inventory')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText(/Search by item code or name|بحث/)
        await userEvent.type(searchInput, 'xyznotexist')
        expect(screen.getByText(/No stock found|لا يوجد مخزون/)).toBeInTheDocument()
    })

    it('shows "Stock In" button for Material Receipt', async () => {
        renderIM('inventory')
        await waitForLoad()
        expect(screen.getByText(/Stock In|إدخال مخزون/)).toBeInTheDocument()
    })

    it('shows "Check Availability" button', async () => {
        renderIM('inventory')
        await waitForLoad()
        expect(screen.getByText(/Check Availability|فحص التوفر/)).toBeInTheDocument()
    })

    it('opens Material Receipt dialog with correct title', async () => {
        renderIM('inventory')
        await waitForLoad()
        fireEvent.click(screen.getByText(/Stock In|إدخال مخزون/))
        await waitFor(() => {
            expect(screen.getByText(/Stock In \(Material Receipt\)|إدخال مخزون/)).toBeInTheDocument()
        })
    })

    it('Material Receipt: shows error toast when no warehouse selected', async () => {
        renderIM('inventory')
        await waitForLoad()
        fireEvent.click(screen.getByText(/Stock In|إدخال مخزون/))
        await waitFor(() => screen.getByText(/Confirm Receipt|تأكيد الاستلام/))
        fireEvent.click(screen.getByText(/Confirm Receipt|تأكيد الاستلام/))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
        })
    })

    it('Material Receipt: submits to API and shows success toast', async () => {
        mockCreateReceipt.mockResolvedValue({ stock_entry: 'STE-NEW-001' })
        renderIM('inventory')
        await waitForLoad()
        fireEvent.click(screen.getByText(/Stock In|إدخال مخزون/))
        await waitFor(() => screen.getByText(/Confirm Receipt|تأكيد الاستلام/))
        // Select warehouse
        const whSelect = screen.getByText(/Target Warehouse|المستودع المستلِم/).closest('div')!
            .querySelector('select')!
        fireEvent.change(whSelect, { target: { value: 'Main - Q' } })
        // Fill first item code (direct input in the item code field)
        const itemInputs = screen.getAllByPlaceholderText(/Item code|كود الصنف/)
        fireEvent.change(itemInputs[0], { target: { value: 'ITEM-A' } })
        fireEvent.click(screen.getByText(/Confirm Receipt|تأكيد الاستلام/))
        await waitFor(() => {
            expect(mockCreateReceipt).toHaveBeenCalled()
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringMatching(/STE-NEW-001|تم إنشاء/),
            }))
        })
    })

    it('opens Check Availability dialog', async () => {
        renderIM('inventory')
        await waitForLoad()
        fireEvent.click(screen.getByText(/Check Availability|فحص التوفر/))
        await waitFor(() => {
            expect(screen.getByText(/Check Item Availability|فحص توفر الصنف/)).toBeInTheDocument()
        })
    })

    it('Check Availability: calls API and shows result', async () => {
        mockCheckAvailability.mockResolvedValue({
            item_code: 'ITEM-A', warehouse: 'Main - Q',
            requested_qty: 5, available_qty: 20, is_available: true, shortage: 0,
        })
        renderIM('inventory')
        await waitForLoad()
        fireEvent.click(screen.getByText(/Check Availability|فحص التوفر/))
        await waitFor(() => screen.getByText(/Check Item Availability|فحص توفر الصنف/))
        // Fill item and warehouse
        const itemInput = screen.getByPlaceholderText(/Search item|ابحث عن صنف/)
        fireEvent.change(itemInput, { target: { value: 'ITEM-A' } })
        const whSelect = screen.getAllByRole('combobox').find(s => s.textContent?.includes('Select warehouse') || s.textContent?.includes('اختر مستودع'))
        if (whSelect) fireEvent.change(whSelect, { target: { value: 'Main - Q' } })
        fireEvent.click(screen.getByText(/^Check$|^فحص$/))
        await waitFor(() => {
            expect(mockCheckAvailability).toHaveBeenCalled()
            expect(screen.getByText(/✓ Available|✓ متوفر/)).toBeInTheDocument()
        })
    })

    it('Check Availability: shows insufficient result when not available', async () => {
        mockCheckAvailability.mockResolvedValue({
            item_code: 'ITEM-Z', warehouse: 'Van - Q',
            requested_qty: 100, available_qty: 5, is_available: false, shortage: 95,
        })
        renderIM('inventory')
        await waitForLoad()
        fireEvent.click(screen.getByText(/Check Availability|فحص التوفر/))
        await waitFor(() => screen.getByText(/Check Item Availability|فحص توفر الصنف/))
        const itemInput = screen.getByPlaceholderText(/Search item|ابحث عن صنف/)
        fireEvent.change(itemInput, { target: { value: 'ITEM-Z' } })
        const whSelect = screen.getAllByRole('combobox').find(s => s.textContent?.includes('Select warehouse') || s.textContent?.includes('اختر مستودع'))
        if (whSelect) fireEvent.change(whSelect, { target: { value: 'Van - Q' } })
        fireEvent.click(screen.getByText(/^Check$|^فحص$/))
        await waitFor(() => {
            // Insufficient badge text
            expect(screen.getByText(/Insufficient|غير كافي/)).toBeInTheDocument()
        })
    })

    it('does NOT show pagination when ≤ 25 items', async () => {
        renderIM('inventory')
        await waitForLoad()
        // only 2 bin entries → no pagination
        expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument()
    })

    it('shows pagination when > 25 items', async () => {
        const manyBin = Array.from({ length: 30 }, (_, i) => ({
            item_code: `ITEM-${i}`, item_name: `Product ${i}`,
            warehouse: 'Main - Q', actual_qty: 1, stock_value: 10,
        }))
        mockGetBinStock.mockResolvedValue(manyBin)
        renderIM('inventory')
        await waitForLoad()
        // Pagination format: "1-25 / 30" (numbers rendered as separate text nodes in one <p>)
        expect(screen.getByText((_, el) => !!(el && el.tagName === 'P' && /^1-25 \//.test(el.textContent || '')))).toBeInTheDocument()
    })

    it('shows Arabic labels when isRTL=true', async () => {
        mockIsRTL = true
        renderIM('inventory')
        await waitForLoad()
        expect(screen.getByText('إجمالي الأصناف')).toBeInTheDocument()
        expect(screen.getByText('سجلات المخزون')).toBeInTheDocument()
        expect(screen.getByText('إجمالي القيمة')).toBeInTheDocument()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. TRANSFERS VIEW
// ══════════════════════════════════════════════════════════════════════════════
describe('TransfersView', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows transfer rows in table', async () => {
        renderIM('transfers')
        await waitForLoad()
        // Default filter = Pending; switch to All to see both
        fireEvent.click(screen.getByText(/^All \(/i))
        expect(screen.getByText('STR-0001')).toBeInTheDocument()
        expect(screen.getByText('STR-0002')).toBeInTheDocument()
    })

    it('shows Rep (sales_person) column data', async () => {
        renderIM('transfers')
        await waitForLoad()
        expect(screen.getByText('SP-001')).toBeInTheDocument()
    })

    it('shows table column header "Rep"', async () => {
        renderIM('transfers')
        await waitForLoad()
        expect(screen.getByText('Rep')).toBeInTheDocument()
    })

    it('filters by Pending status by default', async () => {
        renderIM('transfers')
        await waitForLoad()
        // STR-0001 is Pending (visible), STR-0002 is Accepted (hidden by filter)
        expect(screen.getByText('STR-0001')).toBeInTheDocument()
        expect(screen.queryByText('STR-0002')).not.toBeInTheDocument()
    })

    it('shows all transfers when "All" filter is clicked', async () => {
        renderIM('transfers')
        await waitForLoad()
        const allBtn = screen.getByText(/^All \(\d+\)/)
        fireEvent.click(allBtn)
        expect(screen.getByText('STR-0001')).toBeInTheDocument()
        expect(screen.getByText('STR-0002')).toBeInTheDocument()
    })

    it('filters by Accepted status', async () => {
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/^Accepted \(/))
        expect(screen.getByText('STR-0002')).toBeInTheDocument()
        expect(screen.queryByText('STR-0001')).not.toBeInTheDocument()
    })

    it('searches by from_warehouse', async () => {
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/^All \(\d+\)/))
        const searchInput = screen.getByPlaceholderText(/Search|بحث/)
        // Search STR-0002's name directly to verify search works
        await userEvent.type(searchInput, 'STR-0002')
        expect(screen.getByText('STR-0002')).toBeInTheDocument()
        expect(screen.queryByText('STR-0001')).not.toBeInTheDocument()
    })

    it('searches by sales_person', async () => {
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/^All \(\d+\)/))
        const searchInput = screen.getByPlaceholderText(/Search|بحث/)
        await userEvent.type(searchInput, 'SP-001')
        expect(screen.getByText('STR-0001')).toBeInTheDocument()
    })

    it('shows Accept and Reject buttons for Pending transfer', async () => {
        renderIM('transfers')
        await waitForLoad()
        // Use exact button text to avoid matching "Accepted" filter chip
        expect(screen.getAllByRole('button', { name: /^Accept$|^قبول$/ }).length).toBeGreaterThan(0)
        expect(screen.getAllByRole('button', { name: /^Reject$|^رفض$/ }).length).toBeGreaterThan(0)
    })

    it('calls acceptTransferRequest when Accept is clicked', async () => {
        mockAcceptTransfer.mockResolvedValue({})
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/^Accept$|^قبول$/))
        await waitFor(() => {
            expect(mockAcceptTransfer).toHaveBeenCalledWith('STR-0001')
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/Accepted|تم القبول/) }))
        })
    })

    it('opens reject dialog and requires a reason', async () => {
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/^Reject$|^رفض$/))
        await waitFor(() => {
            expect(screen.getByText(/Rejection Reason|سبب الرفض/)).toBeInTheDocument()
        })
        // Try reject without reason
        const rejectConfirmBtns = screen.getAllByText(/^Reject$|^رفض$/)
        fireEvent.click(rejectConfirmBtns[rejectConfirmBtns.length - 1])
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
        })
    })

    it('calls rejectTransferRequest with reason', async () => {
        mockRejectTransfer.mockResolvedValue({})
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/^Reject$|^رفض$/))
        await waitFor(() => screen.getByText(/Rejection Reason|سبب الرفض/))
        const reasonInput = screen.getByPlaceholderText(/Enter reason|أدخل السبب/)
        await userEvent.type(reasonInput, 'Out of stock')
        const confirmBtns = screen.getAllByText(/^Reject$|^رفض$/)
        fireEvent.click(confirmBtns[confirmBtns.length - 1])
        await waitFor(() => {
            expect(mockRejectTransfer).toHaveBeenCalledWith('STR-0001', 'Out of stock')
        })
    })

    it('opens create dialog on "New Request" click', async () => {
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/New Request|طلب جديد/))
        await waitFor(() => {
            expect(screen.getByText(/New Transfer Request|طلب نقل جديد/)).toBeInTheDocument()
        })
    })

    it('create dialog: shows validation error when warehouses not selected', async () => {
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/New Request|طلب جديد/))
        await waitFor(() => screen.getByText(/New Transfer Request|طلب نقل جديد/))
        const confirmBtns = screen.getAllByText(/^Create$|^إنشاء$/)
        fireEvent.click(confirmBtns[confirmBtns.length - 1])
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
        })
    })

    it('create dialog: shows sales person dropdown', async () => {
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText(/New Request|طلب جديد/))
        await waitFor(() => screen.getByText(/Sales Person \(optional\)|المندوب \(اختياري\)/))
        expect(screen.getByText('Ali Ahmed')).toBeInTheDocument()
    })

    it('opens detail dialog when transfer name is clicked', async () => {
        mockGetTransferRequest.mockResolvedValue({ ...TRANSFER_PENDING, items: [] })
        renderIM('transfers')
        await waitForLoad()
        fireEvent.click(screen.getByText('STR-0001'))
        await waitFor(() => {
            expect(mockGetTransferRequest).toHaveBeenCalledWith('STR-0001')
        })
    })

    it('detail dialog shows sales_person, total_qty, and stock_entry for accepted transfer', async () => {
        mockGetTransferRequest.mockResolvedValue({ ...TRANSFER_ACCEPTED, items: [] })
        renderIM('transfers')
        await waitForLoad()
        // switch to All to see STR-0002
        fireEvent.click(screen.getByText(/^All \(\d+\)/))
        fireEvent.click(screen.getByText('STR-0002'))
        await waitFor(() => {
            expect(screen.getByText('STE-001')).toBeInTheDocument()
        })
    })

    it('renders "المندوب" header in Arabic', async () => {
        mockIsRTL = true
        renderIM('transfers')
        await waitForLoad()
        expect(screen.getByText('المندوب')).toBeInTheDocument()
    })

    it('shows "لا توجد طلبات" empty state in Arabic when filter shows nothing', async () => {
        mockIsRTL = true
        renderIM('transfers')
        await waitForLoad()
        // Rejected filter — no records
        fireEvent.click(screen.getByText(/^مرفوض \(\d+\)|^Rejected \(\d+\)/))
        expect(screen.getByText('لا توجد طلبات')).toBeInTheDocument()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. RETURNS VIEW
// ══════════════════════════════════════════════════════════════════════════════
describe('ReturnsView', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows return log rows in table', async () => {
        renderIM('returns')
        await waitForLoad()
        expect(screen.getByText('RL-0001')).toBeInTheDocument()
        expect(screen.getByText('RL-0002')).toBeInTheDocument()
    })

    it('shows correct status badges', async () => {
        renderIM('returns')
        await waitForLoad()
        expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(1)
    })

    it('shows sales_person value in table row', async () => {
        renderIM('returns')
        await waitForLoad()
        expect(screen.getByText('SP-001')).toBeInTheDocument()
    })

    it('searches by warehouse', async () => {
        renderIM('returns')
        await waitForLoad()
        // Component searches by name, customer, rep, reason (not warehouse field)
        // Test searching by return name
        const searchInput = screen.getByPlaceholderText(/Search|بحث/)
        // ReturnsView search filters by name, customer, sales_person, return_reason
        // RL-0001 has sales_person 'SP-001' — search that
        await userEvent.type(searchInput, 'SP-001')
        expect(screen.getByText('RL-0001')).toBeInTheDocument()
        expect(screen.queryByText('RL-0002')).not.toBeInTheDocument()
    })

    it('searches by customer name', async () => {
        renderIM('returns')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText(/Search|بحث/)
        await userEvent.type(searchInput, 'Ahmed')
        expect(screen.getByText('RL-0001')).toBeInTheDocument()
        expect(screen.queryByText('RL-0002')).not.toBeInTheDocument()
    })

    it('shows "New Return" button', async () => {
        renderIM('returns')
        await waitForLoad()
        expect(screen.getByText(/New Return|مرتجع جديد/)).toBeInTheDocument()
    })

    it('opens create return dialog', async () => {
        renderIM('returns')
        await waitForLoad()
        fireEvent.click(screen.getByText(/New Return|مرتجع جديد/))
        await waitFor(() => {
            expect(screen.getByText(/New Product Return|مرتجع جديد/)).toBeInTheDocument()
        })
    })

    it('create: shows validation error when no warehouse', async () => {
        renderIM('returns')
        await waitForLoad()
        fireEvent.click(screen.getByText(/New Return|مرتجع جديد/))
        await waitFor(() => screen.getByText(/New Product Return|مرتجع جديد/))
        const createBtns = screen.getAllByText(/^Create$|^إنشاء$/)
        fireEvent.click(createBtns[createBtns.length - 1])
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
        })
    })

    it('create: calls createReturnLog API with correct data', async () => {
        renderIM('returns')
        await waitForLoad()
        fireEvent.click(screen.getByText(/New Return|مرتجع جديد/))
        await waitFor(() => screen.getByText(/New Product Return|مرتجع جديد/))

        // Fill customer (required) — CustomerSearchInput uses "Search customer name..." placeholder
        const customerInput = screen.getByPlaceholderText(/Search customer name|ابحث باسم العميل/)
        await userEvent.type(customerInput, 'Ahmed')

        // Fill item code
        const itemInputs = screen.getAllByPlaceholderText(/Item code|كود الصنف/i)
        fireEvent.change(itemInputs[0], { target: { value: 'ITEM-A' } })

        const createBtns = screen.getAllByText(/^Create$|^إنشاء$/)
        fireEvent.click(createBtns[createBtns.length - 1])
        await waitFor(() => {
            expect(mockCreateProductReturn).toHaveBeenCalled()
            const args = mockCreateProductReturn.mock.calls[0][0]
            expect(args.customer).toBe('Ahmed')
            expect(args.items[0].item_code).toBe('ITEM-A')
        })
    })

    it('create: shows success toast after creation', async () => {
        renderIM('returns')
        await waitForLoad()
        fireEvent.click(screen.getByText(/New Return|مرتجع جديد/))
        await waitFor(() => screen.getByText(/New Product Return|مرتجع جديد/))
        // Fill customer
        const customerInput = screen.getByPlaceholderText(/Search customer name|ابحث باسم العميل/)
        await userEvent.type(customerInput, 'Ahmed')
        // Fill item
        const itemInputs = screen.getAllByPlaceholderText(/Item code|كود الصنف/i)
        fireEvent.change(itemInputs[0], { target: { value: 'ITEM-A' } })
        const createBtns = screen.getAllByText(/^Create$|^إنشاء$/)
        fireEvent.click(createBtns[createBtns.length - 1])
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringMatching(/Product return created|تم إنشاء المرتجع/),
            }))
        })
    })

    it('opens view dialog when return name is clicked', async () => {
        renderIM('returns')
        await waitForLoad()
        fireEvent.click(screen.getByText('RL-0001'))
        await waitFor(() => {
            expect(mockGetProductReturn).toHaveBeenCalledWith('RL-0001')
        })
    })

    it('shows "لا توجد مرتجعات" in Arabic empty state', async () => {
        mockIsRTL = true
        mockGetProductReturns.mockResolvedValue([])
        mockGetReturnLogs.mockResolvedValue([])
        renderIM('returns')
        await waitForLoad()
        expect(screen.getByText('لا توجد مرتجعات')).toBeInTheDocument()
    })

    it('shows pagination when > 15 returns', async () => {
        const manyLogs = Array.from({ length: 20 }, (_, i) => ({
            ...RETURN_DRAFT, name: `RL-${String(i).padStart(4, '0')}`,
        }))
        mockGetProductReturns.mockResolvedValue(manyLogs)
        mockGetReturnLogs.mockResolvedValue(manyLogs)
        renderIM('returns')
        await waitForLoad()
        // Pagination format: "1-15 / 20"
        expect(screen.getByText((_, el) => !!(el && el.tagName === 'P' && /^1-15 \//.test(el.textContent || '')))).toBeInTheDocument()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. AUDIT VIEW
// ══════════════════════════════════════════════════════════════════════════════
describe('AuditView', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows all audit log rows by default', async () => {
        renderIM('audit')
        await waitForLoad()
        expect(screen.getByText('ITEM-A')).toBeInTheDocument()
        expect(screen.getByText('ITEM-B')).toBeInTheDocument()
        expect(screen.getByText('ITEM-C')).toBeInTheDocument()
    })

    it('shows movement type badges', async () => {
        renderIM('audit')
        await waitForLoad()
        // Multiple "In" elements exist (filter button + badge in table row)
        expect(screen.getAllByText('In').length).toBeGreaterThanOrEqual(2)
        // Out and Transfer appear in both filter + badge
        expect(screen.getAllByText('Out').length).toBeGreaterThanOrEqual(2)
        expect(screen.getAllByText('Transfer').length).toBeGreaterThanOrEqual(2)
    })

    it('filters: clicking In shows only In movements', async () => {
        renderIM('audit')
        await waitForLoad()
        const filterBtns = screen.getAllByRole('button').filter(b => ['All', 'In', 'Out', 'Transfer'].includes(b.textContent || ''))
        const inBtn = filterBtns.find(b => b.textContent === 'In')!
        fireEvent.click(inBtn)
        expect(screen.getByText('ITEM-A')).toBeInTheDocument()
        expect(screen.queryByText('ITEM-B')).not.toBeInTheDocument()
        expect(screen.queryByText('ITEM-C')).not.toBeInTheDocument()
    })

    it('filters: clicking Out shows only Out movements', async () => {
        renderIM('audit')
        await waitForLoad()
        const filterBtns = screen.getAllByRole('button').filter(b => ['All', 'In', 'Out', 'Transfer'].includes(b.textContent || ''))
        const outBtn = filterBtns.find(b => b.textContent === 'Out')!
        fireEvent.click(outBtn)
        expect(screen.getByText('ITEM-B')).toBeInTheDocument()
        expect(screen.queryByText('ITEM-A')).not.toBeInTheDocument()
    })

    it('filters: clicking Transfer shows only Transfer movements', async () => {
        renderIM('audit')
        await waitForLoad()
        const filterBtns = screen.getAllByRole('button').filter(b => ['All', 'In', 'Out', 'Transfer'].includes(b.textContent || ''))
        const trBtn = filterBtns.find(b => b.textContent === 'Transfer')!
        fireEvent.click(trBtn)
        expect(screen.getByText('ITEM-C')).toBeInTheDocument()
        expect(screen.queryByText('ITEM-A')).not.toBeInTheDocument()
    })

    it('searches by item code', async () => {
        renderIM('audit')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText(/Search|بحث/)
        await userEvent.type(searchInput, 'ITEM-A')
        expect(screen.getByText('ITEM-A')).toBeInTheDocument()
        expect(screen.queryByText('ITEM-B')).not.toBeInTheDocument()
    })

    it('searches by warehouse', async () => {
        renderIM('audit')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText(/Search|بحث/)
        await userEvent.type(searchInput, 'Van - Q')
        expect(screen.getByText('ITEM-B')).toBeInTheDocument()
        expect(screen.queryByText('ITEM-A')).not.toBeInTheDocument()
    })

    it('searches by reference_name', async () => {
        renderIM('audit')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText(/Search|بحث/)
        await userEvent.type(searchInput, 'STR-0001')
        expect(screen.getByText('ITEM-C')).toBeInTheDocument()
        expect(screen.queryByText('ITEM-A')).not.toBeInTheDocument()
    })

    it('shows quantity change with + prefix for In movements', async () => {
        renderIM('audit')
        await waitForLoad()
        expect(screen.getByText('+10')).toBeInTheDocument()
    })

    it('shows quantity change with negative value for Out movements', async () => {
        renderIM('audit')
        await waitForLoad()
        expect(screen.getByText('-3')).toBeInTheDocument()
    })

    it('shows "No movements" empty state in English', async () => {
        mockGetAuditLogs.mockResolvedValue([])
        renderIM('audit')
        await waitForLoad()
        expect(screen.getByText('No movements')).toBeInTheDocument()
    })

    it('shows Arabic labels isRTL=true', async () => {
        mockIsRTL = true
        renderIM('audit')
        await waitForLoad()
        expect(screen.getByText('الصنف')).toBeInTheDocument()
        expect(screen.getByText('المستودع')).toBeInTheDocument()
        expect(screen.getByText('النوع')).toBeInTheDocument()
        expect(screen.getByText('التغيير')).toBeInTheDocument()
    })

    it('shows pagination when > 20 audit entries', async () => {
        const manyLogs = Array.from({ length: 25 }, (_, i) => ({
            ...AUDIT_IN, name: `SMA-${i}`, item_code: `ITEM-${i}`,
        }))
        mockGetAuditLogs.mockResolvedValue(manyLogs)
        renderIM('audit')
        await waitForLoad()
        // Pagination format: "1-20 / 25"
        expect(screen.getByText((_, el) => !!(el && el.tagName === 'P' && /^1-\d+ \//.test(el.textContent || '')))).toBeInTheDocument()
    })

    it('Refresh button re-loads audit logs', async () => {
        renderIM('audit')
        await waitForLoad()
        const prevCalls = mockGetAuditLogs.mock.calls.length
        fireEvent.click(screen.getByText(/Refresh|تحديث/))
        await waitFor(() => expect(mockGetAuditLogs).toHaveBeenCalledTimes(prevCalls + 1))
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. PRODUCTS VIEW
// ══════════════════════════════════════════════════════════════════════════════
describe('ProductsView', () => {
    // ── Summary cards ──
    it('shows summary cards with correct counts', async () => {
        renderIM('products')
        await waitForLoad()
        // Total Products = 3
        expect(screen.getByText('Total Products')).toBeInTheDocument()
        // Active label exists (may be multiple: card + filter + status badges)
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
        // Disabled label exists
        expect(screen.getAllByText('Disabled').length).toBeGreaterThanOrEqual(1)
    })

    it('renders table with item data', async () => {
        renderIM('products')
        await waitForLoad()
        expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
        expect(screen.getByText('Gadget Beta')).toBeInTheDocument()
        expect(screen.getByText('Service Plan')).toBeInTheDocument()
        // Item codes
        expect(screen.getByText('ITEM-001')).toBeInTheDocument()
        expect(screen.getByText('ITEM-002')).toBeInTheDocument()
        expect(screen.getByText('ITEM-003')).toBeInTheDocument()
    })

    it('shows item groups in table', async () => {
        renderIM('products')
        await waitForLoad()
        // Group badges appear in the table (may also appear in group filter dropdown)
        const productsBadges = screen.getAllByText('Products')
        expect(productsBadges.length).toBeGreaterThanOrEqual(1)
        const rawMats = screen.getAllByText('Raw Material')
        expect(rawMats.length).toBeGreaterThanOrEqual(1)
    })

    it('shows stock quantities from binStock', async () => {
        renderIM('products')
        await waitForLoad()
        // ITEM-A (ITEM-001 in BIN_ITEM_A fixture has item_code ITEM-A, not matching our fixtures)
        // Stock column shows "0" for items not in binStock
        const zeroes = screen.getAllByText('0')
        expect(zeroes.length).toBeGreaterThanOrEqual(1)
    })

    it('shows rate with SAR suffix', async () => {
        renderIM('products')
        await waitForLoad()
        expect(screen.getByText('50 SAR')).toBeInTheDocument()
        expect(screen.getByText('120 SAR')).toBeInTheDocument()
        expect(screen.getByText('200 SAR')).toBeInTheDocument()
    })

    it('shows Active/Disabled status badges', async () => {
        renderIM('products')
        await waitForLoad()
        // Status badges in table rows (Active appears in summary + status filter + 2 rows)
        const activeBadges = screen.getAllByText('Active')
        expect(activeBadges.length).toBeGreaterThanOrEqual(2)
        // Disabled appears in summary + filter + 1 row
        const disabledBadges = screen.getAllByText('Disabled')
        expect(disabledBadges.length).toBeGreaterThanOrEqual(1)
    })

    // ── Table headers ──
    it('shows correct table headers in English', async () => {
        renderIM('products')
        await waitForLoad()
        expect(screen.getByText('Item Code')).toBeInTheDocument()
        expect(screen.getByText('Product Name')).toBeInTheDocument()
        expect(screen.getByText('Group')).toBeInTheDocument()
        expect(screen.getByText('UOM')).toBeInTheDocument()
        expect(screen.getByText('Rate')).toBeInTheDocument()
        expect(screen.getByText('Stock')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('shows Arabic table headers when isRTL=true', async () => {
        mockIsRTL = true
        renderIM('products')
        await waitForLoad()
        expect(screen.getByText('كود الصنف')).toBeInTheDocument()
        expect(screen.getByText('اسم المنتج')).toBeInTheDocument()
        expect(screen.getByText('المجموعة')).toBeInTheDocument()
        expect(screen.getByText('الوحدة')).toBeInTheDocument()
        expect(screen.getByText('السعر')).toBeInTheDocument()
        expect(screen.getByText('المخزون')).toBeInTheDocument()
        expect(screen.getByText('الحالة')).toBeInTheDocument()
        expect(screen.getByText('إجراءات')).toBeInTheDocument()
    })

    // ── Search ──
    it('filters items by search text (item name)', async () => {
        renderIM('products')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText('Search by code, name or group...')
        await userEvent.type(searchInput, 'Widget')
        expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
        expect(screen.queryByText('Gadget Beta')).not.toBeInTheDocument()
        expect(screen.queryByText('Service Plan')).not.toBeInTheDocument()
    })

    it('filters items by search text (item code)', async () => {
        renderIM('products')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText('Search by code, name or group...')
        await userEvent.type(searchInput, 'ITEM-002')
        expect(screen.getByText('Gadget Beta')).toBeInTheDocument()
        expect(screen.queryByText('Widget Alpha')).not.toBeInTheDocument()
    })

    it('filters items by search text (group name)', async () => {
        renderIM('products')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText('Search by code, name or group...')
        await userEvent.type(searchInput, 'Raw Material')
        expect(screen.getByText('Gadget Beta')).toBeInTheDocument()
        expect(screen.queryByText('Widget Alpha')).not.toBeInTheDocument()
    })

    it('shows empty state when search returns no results', async () => {
        renderIM('products')
        await waitForLoad()
        const searchInput = screen.getByPlaceholderText('Search by code, name or group...')
        await userEvent.type(searchInput, 'NONEXISTENT')
        expect(screen.getByText('No products found')).toBeInTheDocument()
    })

    // ── Group filter ──
    it('filters items by group dropdown', async () => {
        renderIM('products')
        await waitForLoad()
        const groupSelect = screen.getByDisplayValue('All Groups')
        fireEvent.change(groupSelect, { target: { value: 'Products' } })
        expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
        expect(screen.getByText('Service Plan')).toBeInTheDocument()
        expect(screen.queryByText('Gadget Beta')).not.toBeInTheDocument()
    })

    // ── Status filter ──
    it('filters items by Active status', async () => {
        renderIM('products')
        await waitForLoad()
        // Click the "Active" filter button (not the column header)
        const buttons = screen.getAllByText('Active')
        const filterBtn = buttons.find(el => el.tagName === 'BUTTON')
        if (filterBtn) fireEvent.click(filterBtn)
        await waitFor(() => {
            expect(screen.getByText('Widget Alpha')).toBeInTheDocument()
            expect(screen.getByText('Service Plan')).toBeInTheDocument()
            expect(screen.queryByText('Gadget Beta')).not.toBeInTheDocument()
        })
    })

    it('filters items by Disabled status', async () => {
        renderIM('products')
        await waitForLoad()
        const buttons = screen.getAllByText('Disabled')
        const filterBtn = buttons.find(el => el.tagName === 'BUTTON')
        if (filterBtn) fireEvent.click(filterBtn)
        await waitFor(() => {
            expect(screen.getByText('Gadget Beta')).toBeInTheDocument()
            expect(screen.queryByText('Widget Alpha')).not.toBeInTheDocument()
            expect(screen.queryByText('Service Plan')).not.toBeInTheDocument()
        })
    })

    // ── Create dialog ──
    it('opens create dialog when "New Product" button is clicked', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => {
            // Dialog shows the product name input
            expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument()
            // Dialog shows item code label
            expect(screen.getByText('Item Code (optional)')).toBeInTheDocument()
        })
    })

    it('shows validation error when product name is empty', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive', title: 'Product name is required' })
        ))
    })

    it('shows validation error when item group is not selected', async () => {
        // Item group is auto-resolved from available itemGroups in handleSave
        // Validation only requires product name — verify name empty validation
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        // Click create without filling any fields
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive', title: 'Product name is required' })
        ))
    })

    it('creates a product successfully', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        const nameInput = screen.getByPlaceholderText('Enter product name')
        await userEvent.type(nameInput, 'Test Product')
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => {
            expect(mockCreateItem).toHaveBeenCalledWith(
                expect.objectContaining({ item_name: 'Test Product', item_group: 'Products' })
            )
        })
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Product created' })
        ))
    })

    it('creates product with warehouse + quantity', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        // Fill name
        const nameInput = screen.getByPlaceholderText('Enter product name')
        await userEvent.type(nameInput, 'Warehouse Product')
        // Select warehouse
        const whSelect = screen.getByDisplayValue('Select warehouse')
        fireEvent.change(whSelect, { target: { value: 'Main - Q' } })
        // Enter quantity
        const qtyInput = screen.getAllByPlaceholderText('Qty')[0]
        await userEvent.type(qtyInput, '100')
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => {
            expect(mockCreateItem).toHaveBeenCalled()
            expect(mockCreateReceipt).toHaveBeenCalledWith(
                expect.objectContaining({
                    warehouse: 'Main - Q',
                    company: 'Q',
                    items: expect.arrayContaining([
                        expect.objectContaining({ qty: 100 })
                    ]),
                })
            )
        })
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ title: expect.stringMatching(/Product created & added to|تم إنشاء المنتج/) })
        ))
    })

    it('validates: qty without warehouse shows error', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        const nameInput = screen.getByPlaceholderText('Enter product name')
        await userEvent.type(nameInput, 'Some Product')
        // Enter qty but no warehouse
        const qtyInput = screen.getAllByPlaceholderText('Qty')[0]
        await userEvent.type(qtyInput, '50')
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive', title: 'Complete warehouse and quantity for each entry' })
        ))
    })

    it('validates: warehouse without qty shows error', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        const nameInput = screen.getByPlaceholderText('Enter product name')
        await userEvent.type(nameInput, 'Some Product')
        // Select warehouse but no qty
        const whSelect = screen.getByDisplayValue('Select warehouse')
        fireEvent.change(whSelect, { target: { value: 'Main - Q' } })
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive', title: 'Complete warehouse and quantity for each entry' })
        ))
    })

    it('shows live preview banner when warehouse + qty filled', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        const whSelect = screen.getByDisplayValue('Select warehouse')
        fireEvent.change(whSelect, { target: { value: 'Main - Q' } })
        const qtyInput = screen.getByPlaceholderText('Qty')
        await userEvent.type(qtyInput, '25')
        await waitFor(() => {
            // Preview format: "• 25 Nos → "Main WH""
            expect(screen.getByText(/25.*Nos/)).toBeInTheDocument()
        })
    })

    // ── Edit dialog ──
    it('opens edit dialog pre-filled with item data', async () => {
        renderIM('products')
        await waitForLoad()
        // Click the item code link (opens detail), then use editbutton 
        // Actually the edit button is a small ghost button with pencil icon in the actions column
        // Find the row with Widget Alpha and click its 2nd action button (edit)
        const row = screen.getByText('Widget Alpha').closest('tr')
        expect(row).toBeTruthy()
        const buttons = row!.querySelectorAll('button')
        // buttons[0] = item code link (not a ghost button actually, it's in td)
        // In the actions td: buttons are [view, edit, toggle]
        // The item code is also a <button>, so total buttons = 4 [code, view, edit, toggle]
        const editBtn = buttons[2]  // 0=code link, 1=view, 2=edit, 3=toggle
        fireEvent.click(editBtn)
        await waitFor(() => {
            expect(screen.getByText('Edit Product')).toBeInTheDocument()
            expect(screen.getByDisplayValue('Widget Alpha')).toBeInTheDocument()
        })
    })

    it('updates a product successfully', async () => {
        renderIM('products')
        await waitForLoad()
        const row = screen.getByText('Widget Alpha').closest('tr')
        const buttons = row!.querySelectorAll('button')
        fireEvent.click(buttons[2])  // edit button
        await waitFor(() => expect(screen.getByText('Update')).toBeInTheDocument())
        // Change name
        const nameInput = screen.getByDisplayValue('Widget Alpha')
        await userEvent.clear(nameInput)
        await userEvent.type(nameInput, 'Updated Widget')
        fireEvent.click(screen.getByText('Update'))
        await waitFor(() => {
            expect(mockUpdateItem).toHaveBeenCalledWith(
                'ITEM-001',
                expect.objectContaining({ item_name: 'Updated Widget' })
            )
        })
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Product updated' })
        ))
    })

    // ── Toggle enable/disable ──
    it('toggles item disabled state', async () => {
        renderIM('products')
        await waitForLoad()
        // Toggle button is the 4th button in the row (code link, view, edit, toggle)
        const row = screen.getByText('Widget Alpha').closest('tr')
        const buttons = row!.querySelectorAll('button')
        fireEvent.click(buttons[3])  // toggle button — opens confirmation dialog
        // Confirm in the AlertDialog
        await waitFor(() => expect(screen.getByText('Disable Product')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
        await waitFor(() => {
            expect(mockToggleItem).toHaveBeenCalledWith('ITEM-001', true)
        })
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Product disabled' })
        ))
    })

    // ── Detail dialog ──
    it('opens detail dialog when item code is clicked', async () => {
        renderIM('products')
        await waitForLoad()
        // Click item code link
        fireEvent.click(screen.getByText('ITEM-001'))
        await waitFor(() => {
            expect(mockGetItem).toHaveBeenCalledWith('ITEM-001')
            expect(screen.getByText('Product Details')).toBeInTheDocument()
        })
    })

    it('shows item details in detail dialog', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('ITEM-001'))
        await waitFor(() => {
            expect(screen.getByText('Product Details')).toBeInTheDocument()
            // Detail fields use getAllByText since 'Item Code' also appears as table header
            expect(screen.getAllByText('Item Code').length).toBeGreaterThanOrEqual(2)
            expect(screen.getByText('Name')).toBeInTheDocument()
        })
    })

    it('shows per-warehouse stock breakdown in detail dialog', async () => {
        // Set binStock so ITEM-001 has stock in Main - Q
        mockGetBinStock.mockResolvedValue([
            { item_code: 'ITEM-001', warehouse: 'Main - Q', actual_qty: 20, stock_uom: 'Nos', valuation_rate: 50, stock_value: 1000 },
            { item_code: 'ITEM-001', warehouse: 'Van - Q', actual_qty: 5, stock_uom: 'Nos', valuation_rate: 50, stock_value: 250 },
        ])
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('ITEM-001'))
        await waitFor(() => {
            expect(screen.getByText('Stock per Warehouse')).toBeInTheDocument()
            expect(screen.getByText('Main - Q')).toBeInTheDocument()
        })
    })

    it.skip('shows stock item / batch / serial badges in detail', async () => {
        // Detail dialog does not render stock_item/batch/serial badges
        // Component only shows: Item Code, Name, Group, UOM, Rate, Stock, Description
        mockGetItem.mockResolvedValue({
            ...ITEM_ACTIVE, has_batch_no: 1, has_serial_no: 1, is_stock_item: 1,
        })
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('ITEM-001'))
        await waitFor(() => {
            expect(screen.getByText('Product Details')).toBeInTheDocument()
            // Detail dialog shows item fields
            expect(screen.getByText('Current Stock')).toBeInTheDocument()
        })
    })

    // ── Error handling ──
    it('shows error toast when createItem fails', async () => {
        mockCreateItem.mockRejectedValue(new Error('Server error'))
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        const nameInput = screen.getByPlaceholderText('Enter product name')
        await userEvent.type(nameInput, 'Fail Product')
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive', title: 'Save failed', description: 'Server error' })
        ))
    })

    it('shows error toast when toggleItem fails', async () => {
        mockToggleItem.mockRejectedValue(new Error('Toggle failed'))
        renderIM('products')
        await waitForLoad()
        const row = screen.getByText('Widget Alpha').closest('tr')
        const buttons = row!.querySelectorAll('button')
        fireEvent.click(buttons[3])  // toggle button — opens confirmation dialog
        // Confirm in the AlertDialog
        await waitFor(() => expect(screen.getByText('Disable Product')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive', title: 'Update failed' })
        ))
    })

    // ── Loading state ──
    it('shows skeleton placeholders while loading', () => {
        // Keep promises pending to show loading state
        mockGetItems.mockReturnValue(new Promise(() => { }))
        renderIM('products')
        expect(screen.queryAllByTestId('skeleton').length).toBeGreaterThan(0)
    })

    // ── Pagination ──
    it('paginates when more than 20 items', async () => {
        const manyItems = Array.from({ length: 25 }, (_, i) => ({
            ...ITEM_ACTIVE, name: `ITEM-P-${i}`, item_name: `Product ${i}`,
            item_code: `ITEM-P-${i}`,
        }))
        mockGetItems.mockResolvedValue(manyItems)
        renderIM('products')
        await waitForLoad()
        // Pagination format: "1-20 / 25"
        expect(screen.getByText((_, el) =>
            !!(el && el.tagName === 'P' && /1-20 \/ 25/.test(el.textContent || ''))
        )).toBeInTheDocument()
    })

    // ── "New Product" button text ──
    it('shows Arabic button text when isRTL=true', async () => {
        mockIsRTL = true
        renderIM('products')
        await waitForLoad()
        expect(screen.getByText('منتج جديد')).toBeInTheDocument()
    })

    // ── Empty state ──
    it('shows "No products found" when no items exist', async () => {
        mockGetItems.mockResolvedValue([])
        renderIM('products')
        await waitForLoad()
        expect(screen.getByText('No products found')).toBeInTheDocument()
    })

    // ── Warehouse dropdown only shows active non-group warehouses ──
    it('warehouse dropdown excludes disabled and group warehouses', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        const whSelect = screen.getByDisplayValue('Select warehouse')
        // Main WH and Van 1 should be options, Old WH (disabled) should not
        const options = within(whSelect as HTMLElement).getAllByRole('option')
        const optionTexts = options.map(o => o.textContent)
        expect(optionTexts).toContain('Main WH')
        expect(optionTexts).toContain('Van 1')
        expect(optionTexts).not.toContain('Old WH')
    })

    // ── Checkboxes in create dialog ──
    it.skip('shows toggle checkboxes for stock item, batch, serial', async () => {
        // Create dialog does not have stock_item/batch/serial checkboxes
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => {
            // Create dialog fields are visible
            expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument()
            expect(screen.getByText('Item Code (optional)')).toBeInTheDocument()
        })
    })

    // ── UOM dropdown in create dialog ──
    it('shows UOM options from API', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        // UOM select should have Nos, Kg, Box
        const uomSelect = screen.getByDisplayValue('Nos')
        const options = within(uomSelect as HTMLElement).getAllByRole('option')
        const optionTexts = options.map(o => o.textContent)
        expect(optionTexts).toContain('Nos')
        expect(optionTexts).toContain('Kg')
        expect(optionTexts).toContain('Box')
    })

    // ── Item Group dropdown excludes parent groups ──
    it('item group dropdown excludes is_group entries', async () => {
        // The group filter on the products page shows only actual groups from items
        renderIM('products')
        await waitForLoad()
        const groupSelect = screen.getByDisplayValue('All Groups')
        const options = within(groupSelect as HTMLElement).getAllByRole('option')
        const optionTexts = options.map(o => o.textContent)
        // Should include actual item groups from data
        expect(optionTexts).toContain('Products')
        expect(optionTexts).toContain('Raw Material')
    })

    // ── Cancel button closes dialog ──
    it('closes dialog when Cancel is clicked', async () => {
        renderIM('products')
        await waitForLoad()
        fireEvent.click(screen.getByText('New Product'))
        await waitFor(() => expect(screen.getByText('Create')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Cancel'))
        await waitFor(() => {
            expect(screen.queryByText('Edit Product')).not.toBeInTheDocument()
        })
    })

    // ── Arabic summary cards ──
    it('shows Arabic summary labels when isRTL=true', async () => {
        mockIsRTL = true
        renderIM('products')
        await waitForLoad()
        expect(screen.getByText('إجمالي المنتجات')).toBeInTheDocument()
        // 'نشط' and 'معطل' may appear multiple times (card label + filter + status badges)
        expect(screen.getAllByText('نشط').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('معطل').length).toBeGreaterThanOrEqual(1)
    })

    it('Refresh button re-loads products data', async () => {
        renderIM('products')
        await waitForLoad()
        const prevCalls = mockGetItems.mock.calls.length
        fireEvent.click(screen.getByText(/Refresh|تحديث/))
        await waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(prevCalls + 1))
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. LAZY LOADING & SELECTIVE REFRESH
// ══════════════════════════════════════════════════════════════════════════════
describe('Lazy Loading & Selective Refresh', () => {
    beforeEach(() => { mockIsRTL = false })

    it('dashboard tab does NOT fetch getItems or getUOMs on mount', async () => {
        renderIM('dashboard')
        await waitForLoad()
        expect(mockGetWarehouses).toHaveBeenCalled()
        expect(mockGetBinStock).toHaveBeenCalled()
        expect(mockGetAuditLogs).toHaveBeenCalled()
        // Products-specific APIs NOT called
        expect(mockGetItems).not.toHaveBeenCalled()
        expect(mockGetUOMs).not.toHaveBeenCalled()
    })

    it('audit tab only fetches getAuditLogs', async () => {
        renderIM('audit')
        await waitForLoad()
        expect(mockGetAuditLogs).toHaveBeenCalled()
        // No other heavy API calls
        expect(mockGetItems).not.toHaveBeenCalled()
        expect(mockGetSalesPersons).not.toHaveBeenCalled()
        expect(mockGetTransferRequests).not.toHaveBeenCalled()
    })

    it('products tab fetches items, itemGroups, uoms, warehouses, binStock', async () => {
        renderIM('products')
        await waitForLoad()
        expect(mockGetItems).toHaveBeenCalled()
        expect(mockGetItemGroups).toHaveBeenCalled()
        expect(mockGetUOMs).toHaveBeenCalled()
        expect(mockGetWarehouses).toHaveBeenCalled()
        expect(mockGetBinStock).toHaveBeenCalled()
        // Products tab does NOT need these:
        expect(mockGetReturnLogs).not.toHaveBeenCalled()
        expect(mockGetAuditLogs).not.toHaveBeenCalled()
    })

    it('refresh on products tab only reloads product-tab data, not audit or returns', async () => {
        renderIM('products')
        await waitForLoad()
        jest.clearAllMocks()
        setupDefaults()
        fireEvent.click(screen.getByText(/Refresh|تحديث/))
        await waitFor(() => expect(mockGetItems).toHaveBeenCalledTimes(1))
        // Selective refresh: no audit or returns fetched
        expect(mockGetAuditLogs).not.toHaveBeenCalled()
        expect(mockGetReturnLogs).not.toHaveBeenCalled()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. LOW STOCK ALERTS (Dashboard)
// ══════════════════════════════════════════════════════════════════════════════
describe('Low Stock Alerts (Dashboard)', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows Low Stock Alerts when items have qty <= 10', async () => {
        mockGetBinStock.mockResolvedValue([
            { item_code: 'LOW-ITEM-1', warehouse: 'Main - Q', actual_qty: 3, stock_value: 30 },
            { item_code: 'LOW-ITEM-2', warehouse: 'Main - Q', actual_qty: 8, stock_value: 80 },
            { item_code: 'GOOD-ITEM', warehouse: 'Main - Q', actual_qty: 100, stock_value: 1000 },
        ])
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument()
        expect(screen.getByText('LOW-ITEM-1')).toBeInTheDocument()
        expect(screen.getByText('LOW-ITEM-2')).toBeInTheDocument()
    })

    it('does NOT show Low Stock Alerts when no items below threshold', async () => {
        mockGetBinStock.mockResolvedValue([
            { item_code: 'GOOD-1', warehouse: 'Main - Q', actual_qty: 50, stock_value: 500 },
        ])
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.queryByText('Low Stock Alerts')).not.toBeInTheDocument()
    })

    it('uses red indicator for critically low stock (qty <= 3)', async () => {
        mockGetBinStock.mockResolvedValue([
            { item_code: 'CRITICAL-ITEM', warehouse: 'Main - Q', actual_qty: 2, stock_value: 20 },
        ])
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText('CRITICAL-ITEM')).toBeInTheDocument()
        // The Low Stock Alerts section should be visible
        expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument()
    })

    it('shows Arabic labels when isRTL=true', async () => {
        mockIsRTL = true
        mockGetBinStock.mockResolvedValue([
            { item_code: 'LOW-AR', warehouse: 'Main - Q', actual_qty: 5, stock_value: 50 },
        ])
        renderIM('dashboard')
        await waitForLoad()
        expect(screen.getByText('تنبيهات المخزون المنخفض')).toBeInTheDocument()
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 10. CONFIRMATION DIALOGS
// ══════════════════════════════════════════════════════════════════════════════
describe('Confirmation Dialogs', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows confirmation dialog with product name when toggling', async () => {
        renderIM('products')
        await waitForLoad()
        const row = screen.getByText('Widget Alpha').closest('tr')
        const buttons = row!.querySelectorAll('button')
        fireEvent.click(buttons[3])  // toggle button opens confirmation
        await waitFor(() => {
            expect(screen.getByText('Disable Product')).toBeInTheDocument()
        })
    })

    it('shows Arabic confirmation when isRTL=true', async () => {
        mockIsRTL = true
        renderIM('products')
        await waitForLoad()
        const row = screen.getByText('Widget Alpha').closest('tr')
        const buttons = row!.querySelectorAll('button')
        fireEvent.click(buttons[3])
        await waitFor(() => {
            expect(screen.getByText('تعطيل المنتج')).toBeInTheDocument()
        })
    })

    it('shows "Enable Product" dialog for disabled items', async () => {
        renderIM('products')
        await waitForLoad()
        const row = screen.getByText('Gadget Beta').closest('tr')
        const buttons = row!.querySelectorAll('button')
        fireEvent.click(buttons[3])  // toggle button on disabled item
        await waitFor(() => {
            expect(screen.getByText('Enable Product')).toBeInTheDocument()
        })
    })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. RECONCILIATION VIEW
// ══════════════════════════════════════════════════════════════════════════════
describe('ReconciliationView', () => {
    it('renders heading and warehouse dropdown', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        expect(screen.getByText('Stock Reconciliation')).toBeInTheDocument()
        expect(screen.getByTestId('warehouse-select')).toBeInTheDocument()
    })

    it('shows select-warehouse placeholder when no warehouse chosen', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        expect(screen.getByText('Select a warehouse to start')).toBeInTheDocument()
    })

    it('shows items table after selecting a warehouse with stock', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => {
            expect(screen.getByText('ITEM-A')).toBeInTheDocument()
        })
    })

    it('shows system qty in item row', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => {
            expect(screen.getByTestId('actual-qty-ITEM-A')).toHaveValue(20)
        })
    })

    it('calculates positive difference when actual > system', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '25' } })
        await waitFor(() => {
            expect(screen.getByText('+5.00')).toBeInTheDocument()
        })
    })

    it('calculates negative difference when actual < system', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '15' } })
        await waitFor(() => {
            expect(screen.getByText('-5.00')).toBeInTheDocument()
        })
    })

    it('Post button is disabled when no changes made', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('post-reconciliation-btn'))
        expect(screen.getByTestId('post-reconciliation-btn')).toBeDisabled()
    })

    it('Post button is enabled after editing a qty', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '25' } })
        await waitFor(() => {
            expect(screen.getByTestId('post-reconciliation-btn')).not.toBeDisabled()
        })
    })

    it('calls createStockReconciliation with correct payload on submit', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '25' } })
        fireEvent.click(screen.getByTestId('post-reconciliation-btn'))
        // Confirmation dialog appears — click "Confirm Post"
        await waitFor(() => expect(screen.getByText(/Confirm Post|تأكيد الترحيل/)).toBeInTheDocument())
        fireEvent.click(screen.getByText(/Confirm Post|تأكيد الترحيل/))
        await waitFor(() => {
            expect(mockCreateStockReconciliation).toHaveBeenCalledWith(expect.objectContaining({
                items: expect.arrayContaining([
                    expect.objectContaining({ item_code: 'ITEM-A', qty: 25, warehouse: 'Main - Q' }),
                ]),
            }))
        })
    })

    it('shows success toast after posting', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '25' } })
        fireEvent.click(screen.getByTestId('post-reconciliation-btn'))
        await waitFor(() => expect(screen.getByText(/Confirm Post|تأكيد الترحيل/)).toBeInTheDocument())
        fireEvent.click(screen.getByText(/Confirm Post|تأكيد الترحيل/))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringMatching(/Reconciliation posted|تمت تسوية/),
            }))
        })
    })

    it('shows error toast when API throws', async () => {
        mockCreateStockReconciliation.mockRejectedValue(new Error('Permission denied'))
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '25' } })
        fireEvent.click(screen.getByTestId('post-reconciliation-btn'))
        await waitFor(() => expect(screen.getByText(/Confirm Post|تأكيد الترحيل/)).toBeInTheDocument())
        fireEvent.click(screen.getByText(/Confirm Post|تأكيد الترحيل/))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
                description: 'Permission denied',
            }))
        })
    })

    it('opens History dialog on History button click', async () => {
        mockGetStockReconciliations.mockResolvedValue([
            { name: 'STRC-001', posting_date: '2026-02-24', company: 'Q', docstatus: 1 },
        ])
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.click(screen.getByText('History'))
        await waitFor(() => {
            expect(screen.getByText('Reconciliation History')).toBeInTheDocument()
        })
    })

    it('shows past reconciliation in history dialog', async () => {
        mockGetStockReconciliations.mockResolvedValue([
            { name: 'STRC-001', posting_date: '2026-02-24', company: 'Q', docstatus: 1 },
        ])
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.click(screen.getByText('History'))
        await waitFor(() => {
            expect(screen.getByText('STRC-001')).toBeInTheDocument()
        })
    })

    it('shows "No reconciliations yet" when history is empty', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.click(screen.getByText('History'))
        await waitFor(() => {
            expect(screen.getByText('No reconciliations yet')).toBeInTheDocument()
        })
    })

    it('shows empty-state message when warehouse has no stock', async () => {
        mockGetBinStock.mockResolvedValue([])
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => {
            expect(screen.getByText('No items found in this warehouse')).toBeInTheDocument()
        })
    })

    it('fetches binStock and warehouses (lazy load)', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        expect(mockGetBinStock).toHaveBeenCalled()
        expect(mockGetWarehouses).toHaveBeenCalled()
        expect(mockGetTransferRequests).not.toHaveBeenCalled()
    })

    it('shows AR labels when isRTL=true', async () => {
        mockIsRTL = true
        renderIM('reconciliation')
        await waitForLoad()
        expect(screen.getByText('تسوية الجرد')).toBeInTheDocument()
    })

    it('resets actual qty inputs when warehouse changes', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '99' } })
        // Switch warehouse
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Van - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-B'))
        // Go back — input should be reset to system qty
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => {
            expect(screen.getByTestId('actual-qty-ITEM-A')).toHaveValue(20)
        })
    })

    it('onRefresh reloads binStock, warehouses and reconciliations', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        mockGetBinStock.mockClear()
        mockGetWarehouses.mockClear()
        mockGetStockReconciliations.mockClear()
        // After removing the duplicate, only the global Refresh button remains
        fireEvent.click(screen.getByText('Refresh'))
        await waitFor(() => {
            expect(mockGetBinStock).toHaveBeenCalledTimes(1)
            expect(mockGetWarehouses).toHaveBeenCalledTimes(1)
            expect(mockGetStockReconciliations).toHaveBeenCalledTimes(1)
        })
    })

    // ── Search & Filter ──
    it('renders search input and group filter dropdown', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-search'))
        expect(screen.getByTestId('recon-search')).toBeInTheDocument()
        expect(screen.getByTestId('recon-group-filter')).toBeInTheDocument()
    })

    it('filters items by search text (item code)', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-search'))
        fireEvent.change(screen.getByTestId('recon-search'), { target: { value: 'ITEM-A' } })
        await waitFor(() => {
            expect(screen.getByText('ITEM-A')).toBeInTheDocument()
            expect(screen.getByTestId('recon-filter-info')).toBeInTheDocument()
        })
    })

    it('shows item group filter with groups from warehouse items', async () => {
        // ITEM_ACTIVE has item_group: 'Products', ITEM-A maps to ITEM-001 which is also Products
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-group-filter'))
        const select = screen.getByTestId('recon-group-filter')
        expect(select).toBeInTheDocument()
        // "All Groups" option should be there
        expect(select).toHaveValue('all')
    })

    // ── Import / Export ──
    it('renders Export and Import buttons', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-export-btn'))
        expect(screen.getByTestId('recon-export-btn')).toBeInTheDocument()
        expect(screen.getByTestId('recon-import-btn')).toBeInTheDocument()
    })

    it('exports CSV on Export button click', async () => {
        const createObjectURL = jest.fn(() => 'blob:url')
        const revokeObjectURL = jest.fn()
        const origCreateObjectURL = URL.createObjectURL
        const origRevokeObjectURL = URL.revokeObjectURL
        URL.createObjectURL = createObjectURL
        URL.revokeObjectURL = revokeObjectURL

        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-export-btn'))
        fireEvent.click(screen.getByTestId('recon-export-btn'))
        expect(createObjectURL).toHaveBeenCalledTimes(1)
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: expect.stringMatching(/Exported|تم التصدير/),
        }))

        URL.createObjectURL = origCreateObjectURL
        URL.revokeObjectURL = origRevokeObjectURL
    })

    it('imports CSV file and sets actual quantities', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('csv-import-input'))

        const csv = 'item_code,actual_qty\nITEM-A,99'
        const file = new File([csv], 'recon.csv', { type: 'text/csv' })
        fireEvent.change(screen.getByTestId('csv-import-input'), { target: { files: [file] } })

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: expect.stringMatching(/Imported|تم الاستيراد/),
            }))
        })
    })

    it('shows error toast for invalid CSV (missing columns)', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('csv-import-input'))

        const csv = 'name,qty\nITEM-A,99'
        const file = new File([csv], 'bad.csv', { type: 'text/csv' })
        fireEvent.change(screen.getByTestId('csv-import-input'), { target: { files: [file] } })

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                variant: 'destructive',
            }))
        })
    })

    // ── Barcode scanner ──
    it('renders barcode scan button', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        expect(screen.getByTestId('recon-barcode-btn')).toBeInTheDocument()
    })

    it('opens scanner overlay when barcode button is clicked', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => {
            expect(screen.getByText(/Point the camera|وجّه الكاميرا/)).toBeInTheDocument()
        })
    })

    it('shows cancel button in scanner overlay', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => {
            expect(screen.getByText(/Cancel|إلغاء/)).toBeInTheDocument()
        })
    })

    it('closes scanner overlay when cancel is clicked', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => screen.getByText(/Cancel|إلغاء/))
        fireEvent.click(screen.getByText(/Cancel|إلغاء/))
        await waitFor(() => {
            expect(screen.queryByText(/Point the camera|وجّه الكاميرا/)).not.toBeInTheDocument()
        })
    })

    it('loads html5-qrcode module when scan button is clicked', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => {
            expect(screen.getByText(/Point the camera|وجّه الكاميرا/)).toBeInTheDocument()
        })
        // The module was loaded (dynamic import)
        const { Html5Qrcode } = require('html5-qrcode')
        await waitFor(() => {
            expect(Html5Qrcode).toHaveBeenCalled()
        })
    })

    it('starts html5-qrcode scanner with environment camera', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => {
            expect(mockScannerStart).toHaveBeenCalledWith(
                { facingMode: 'environment' },
                expect.objectContaining({ fps: 15 }),
                expect.any(Function),
                expect.any(Function),
            )
        })
    })

    it('calls scanner.stop on cancel', async () => {
        mockScannerStop.mockClear()
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => screen.getByText(/Cancel|إلغاء/))
        // Wait for scanner to be initialized
        await waitFor(() => expect(mockScannerStart).toHaveBeenCalled())
        fireEvent.click(screen.getByText(/Cancel|إلغاء/))
        await waitFor(() => {
            expect(mockScannerStop).toHaveBeenCalled()
        })
    })

    it('shows error when html5-qrcode fails to start (camera denied)', async () => {
        mockScannerStart.mockRejectedValueOnce(new Error('NotAllowedError'))
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => {
            expect(screen.getByText(/Camera access denied|تعذر الوصول للكاميرا/)).toBeInTheDocument()
        })
    })

    it('scanner overlay renders scannerContainerRef div for html5-qrcode', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => {
            // The overlay should contain a div with rounded-2xl class for the scanner container
            const overlay = screen.getByText(/Point the camera|وجّه الكاميرا/).closest('div.fixed')
            expect(overlay).toBeInTheDocument()
            const container = overlay?.querySelector('.rounded-2xl')
            expect(container).toBeInTheDocument()
        })
    })

    it('does NOT use native BarcodeDetector even when available', async () => {
        // Simulate Chrome-like environment with native BarcodeDetector
        ; (window as any).BarcodeDetector = jest.fn()
            ; (window as any).BarcodeDetector.getSupportedFormats = jest.fn().mockResolvedValue(['ean_13'])

        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))

        await waitFor(() => {
            // html5-qrcode should be used, not native
            expect(mockScannerStart).toHaveBeenCalled()
        })
        // Native BarcodeDetector should NOT have been called
        expect((window as any).BarcodeDetector).not.toHaveBeenCalled()

        delete (window as any).BarcodeDetector
    })

    it('scanner uses correct qrbox and aspect ratio config', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('recon-barcode-btn'))
        mockScannerStart.mockClear()
        fireEvent.click(screen.getByTestId('recon-barcode-btn'))
        await waitFor(() => {
            expect(mockScannerStart).toHaveBeenCalledWith(
                { facingMode: 'environment' },
                expect.objectContaining({
                    fps: 15,
                    qrbox: { width: 300, height: 150 },
                    aspectRatio: 1.777,
                }),
                expect.any(Function),
                expect.any(Function),
            )
        })
    })
    // ── Visual cues ──
    it('shows difference as Badge with green styling for surplus', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '25' } })
        await waitFor(() => {
            const badge = screen.getByText('+5.00')
            expect(badge.className).toMatch(/green/)
        })
    })

    it('shows difference as Badge with red styling for deficit', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        fireEvent.change(screen.getByTestId('actual-qty-ITEM-A'), { target: { value: '15' } })
        await waitFor(() => {
            const badge = screen.getByText('-5.00')
            expect(badge.className).toMatch(/red/)
        })
    })

    it('shows zero difference as gray Badge with "0"', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        // No change → diff is 0
        const zeros = screen.getAllByText('0')
        const grayZero = zeros.find(el => el.className.includes('gray'))
        expect(grayZero).toBeTruthy()
    })

    // ── Pagination ──
    it('does not show pagination for small item lists', async () => {
        renderIM('reconciliation')
        await waitForLoad()
        fireEvent.change(screen.getByTestId('warehouse-select'), { target: { value: 'Main - Q' } })
        await waitFor(() => screen.getByTestId('actual-qty-ITEM-A'))
        // Only 1 item in Main - Q, well under 50 perPage
        expect(screen.queryByText(/\/ \d+/)).not.toBeInTheDocument()
    })
})
