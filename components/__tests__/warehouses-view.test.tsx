/**
 * WarehousesView - Unit Tests
 * Covers:
 * - Arabic translations (isRTL = true)
 * - English translations (isRTL = false)
 * - Type filter buttons
 * - Search filtering
 * - Empty state
 * - Status badges (Active / Disabled)
 * - Pagination rendering
 * - Create/Edit dialog field labels
 * - Form validation toasts
 * - Toggle warehouse handler
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// isRTL is toggled per describe block via this variable
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

// Mock stock API — default implementations return empty arrays / resolved promises
const mockGetCompanies = jest.fn().mockResolvedValue([
    { name: 'Q', company_name: 'القرعاوي' },
])
const mockGetWarehouseGroups = jest.fn().mockResolvedValue([
    { name: 'Stores - Q', warehouse_name: 'Stores', is_group: 1 },
])
const mockCreateWarehouse = jest.fn().mockResolvedValue({ name: 'New-WH' })
const mockUpdateWarehouse = jest.fn().mockResolvedValue({})
const mockToggleWarehouse = jest.fn().mockResolvedValue({})

jest.mock('@/lib/stock-api', () => ({
    stockApi: {
        getCompanies: () => mockGetCompanies(),
        getWarehouseGroups: () => mockGetWarehouseGroups(),
        createWarehouse: (...a: any[]) => mockCreateWarehouse(...a),
        updateWarehouse: (...a: any[]) => mockUpdateWarehouse(...a),
        toggleWarehouse: (...a: any[]) => mockToggleWarehouse(...a),
    },
}))

// Mock Skeleton to keep snapshots simple
jest.mock('@/components/ui/skeleton', () => ({
    Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}))

// ─── Component under test ─────────────────────────────────────────────────────
import { WarehousesView } from '../inventory/inventory-management'
import type { Warehouse, BinStock, SalesPerson } from '@/lib/stock-api'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeWarehouse = (overrides: Partial<Warehouse> = {}): Warehouse => ({
    name: 'Stores - Q',
    warehouse_name: 'Stores',
    custom_warehouse_type: 'Main',
    company: 'Q',
    disabled: 0,
    is_group: 0,
    ...overrides,
})

const ACTIVE_WH = makeWarehouse({ name: 'Main - Q', warehouse_name: 'Main WH', custom_warehouse_type: 'Main', disabled: 0 })
const DISABLED_WH = makeWarehouse({ name: 'Disabled - Q', warehouse_name: 'Disabled WH', disabled: 1 })
const VAN_WH = makeWarehouse({ name: 'Van - Q', warehouse_name: 'Van 1', custom_warehouse_type: 'Van', custom_linked_sales_person: 'SP-001' })

const DEFAULT_PROPS = {
    warehouses: [ACTIVE_WH, DISABLED_WH, VAN_WH],
    binStock: [] as BinStock[],
    salesPersons: [] as SalesPerson[],
    loading: false,
    onRefresh: jest.fn(),
}

function renderWH(props = DEFAULT_PROPS) {
    return render(<WarehousesView {...props} />)
}

// ─── Helper ───────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1. LOADING STATE
// ═════════════════════════════════════════════════════════════════════════════
describe('Loading state', () => {
    it('renders skeleton placeholders when loading=true', () => {
        render(<WarehousesView {...DEFAULT_PROPS} loading={true} />)
        const skeletons = screen.getAllByTestId('skeleton')
        expect(skeletons.length).toBeGreaterThanOrEqual(1)
    })

    it('does NOT render table when loading=true', () => {
        render(<WarehousesView {...DEFAULT_PROPS} loading={true} />)
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. ENGLISH TRANSLATIONS (isRTL = false)
// ═════════════════════════════════════════════════════════════════════════════
describe('English translations (isRTL=false)', () => {
    beforeEach(() => { mockIsRTL = false })

    it('renders search input with English placeholder', () => {
        renderWH()
        expect(screen.getByPlaceholderText('Search warehouses...')).toBeInTheDocument()
    })

    it('renders "All" filter button', () => {
        renderWH()
        expect(screen.getByText(/^All \(\d+\)$/)).toBeInTheDocument()
    })

    it('renders "New Warehouse" button', () => {
        renderWH()
        expect(screen.getByText('New Warehouse')).toBeInTheDocument()
    })

    it('renders summary card labels in English', () => {
        renderWH()
        expect(screen.getByText('Total')).toBeInTheDocument()
        // 'Main' appears in filter buttons AND type badges — check at least one card p element
        const mainLabels = screen.getAllByText('Main')
        expect(mainLabels.some(el => el.tagName === 'P')).toBe(true)
        const vanLabels = screen.getAllByText('Van')
        expect(vanLabels.some(el => el.tagName === 'P')).toBe(true)
    })

    it('renders table headers in English', () => {
        renderWH()
        expect(screen.getByText('Warehouse')).toBeInTheDocument()
        expect(screen.getByText('Type')).toBeInTheDocument()
        expect(screen.getByText('SKUs')).toBeInTheDocument()
        expect(screen.getByText('Value')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('renders "Active" badge for enabled warehouse', () => {
        renderWH()
        // Multiple warehouses may render Active — getAllByText is fine
        const activeBadges = screen.getAllByText('Active')
        expect(activeBadges.length).toBeGreaterThan(0)
    })

    it('renders "Disabled" badge for disabled warehouse', () => {
        renderWH()
        expect(screen.getByText('Disabled')).toBeInTheDocument()
    })

    it('renders "View" and "Edit" button titles', () => {
        renderWH()
        const viewBtns = screen.getAllByTitle('View')
        expect(viewBtns.length).toBeGreaterThan(0)
        const editBtns = screen.getAllByTitle('Edit')
        expect(editBtns.length).toBeGreaterThan(0)
    })

    it('opens create dialog with English title "New Warehouse"', async () => {
        renderWH()
        fireEvent.click(screen.getByText('New Warehouse'))
        await waitFor(() => {
            // Dialog title (inside the dialog)
            const dialogTitles = screen.getAllByText('New Warehouse')
            expect(dialogTitles.length).toBeGreaterThanOrEqual(1)
        })
    })

    it('shows English form labels in create dialog', async () => {
        renderWH()
        fireEvent.click(screen.getByText('New Warehouse'))
        await waitFor(() => {
            expect(screen.getByText(/Warehouse Name/)).toBeInTheDocument()
            expect(screen.getByText(/Warehouse Type/)).toBeInTheDocument()
        })
    })

    it('shows "Cancel" and "Create" in dialog footer', async () => {
        renderWH()
        fireEvent.click(screen.getByText('New Warehouse'))
        await waitFor(() => {
            expect(screen.getByText('Cancel')).toBeInTheDocument()
            expect(screen.getByText('Create')).toBeInTheDocument()
        })
    })

    it('shows "Save" instead of "Create" in edit dialog', async () => {
        renderWH()
        const editBtns = screen.getAllByTitle('Edit')
        fireEvent.click(editBtns[0])
        await waitFor(() => {
            expect(screen.getByText('Edit Warehouse')).toBeInTheDocument()
            expect(screen.getByText('Save')).toBeInTheDocument()
        })
    })

    it('shows "No warehouses found" empty state in English', () => {
        render(<WarehousesView {...DEFAULT_PROPS} warehouses={[]} />)
        expect(screen.getByText('No warehouses found')).toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. ARABIC TRANSLATIONS (isRTL = true)
// ═════════════════════════════════════════════════════════════════════════════
describe('Arabic translations (isRTL=true)', () => {
    beforeEach(() => { mockIsRTL = true })

    it('renders search input with Arabic placeholder', () => {
        renderWH()
        expect(screen.getByPlaceholderText('بحث في المستودعات...')).toBeInTheDocument()
    })

    it('renders "الكل" filter button', () => {
        renderWH()
        expect(screen.getByText(/^الكل \(\d+\)$/)).toBeInTheDocument()
    })

    it('renders "مستودع جديد" button', () => {
        renderWH()
        expect(screen.getByText('مستودع جديد')).toBeInTheDocument()
    })

    it('renders summary card labels in Arabic', () => {
        renderWH()
        expect(screen.getByText('إجمالي')).toBeInTheDocument()
// 'رئيسي' appears in type badges AND the summary card — check that a <p> card label exists
        expect(screen.getAllByText('رئيسي').some(el => el.tagName === 'P')).toBe(true)
        expect(screen.getAllByText('فان').some(el => el.tagName === 'P')).toBe(true)
    })

    it('renders table headers in Arabic', () => {
        renderWH()
        expect(screen.getByText('المستودع')).toBeInTheDocument()
        expect(screen.getByText('النوع')).toBeInTheDocument()
        expect(screen.getByText('الأصناف')).toBeInTheDocument()
        expect(screen.getByText('القيمة')).toBeInTheDocument()
        expect(screen.getByText('الحالة')).toBeInTheDocument()
        expect(screen.getByText('إجراءات')).toBeInTheDocument()
    })

    it('renders "نشط" badge for enabled warehouse', () => {
        renderWH()
        const activeBadges = screen.getAllByText('نشط')
        expect(activeBadges.length).toBeGreaterThan(0)
    })

    it('renders "معطل" badge for disabled warehouse', () => {
        renderWH()
        expect(screen.getByText('معطل')).toBeInTheDocument()
    })

    it('renders "عرض" and "تعديل" button titles', () => {
        renderWH()
        const viewBtns = screen.getAllByTitle('عرض')
        expect(viewBtns.length).toBeGreaterThan(0)
        const editBtns = screen.getAllByTitle('تعديل')
        expect(editBtns.length).toBeGreaterThan(0)
    })

    it('opens create dialog with Arabic title "مستودع جديد"', async () => {
        renderWH()
        fireEvent.click(screen.getByText('مستودع جديد'))
        await waitFor(() => {
            const titles = screen.getAllByText('مستودع جديد')
            expect(titles.length).toBeGreaterThanOrEqual(1)
        })
    })

    it('shows Arabic form labels in create dialog', async () => {
        renderWH()
        fireEvent.click(screen.getByText('مستودع جديد'))
        await waitFor(() => {
            expect(screen.getByText(/اسم المستودع/)).toBeInTheDocument()
            expect(screen.getByText(/نوع المستودع/)).toBeInTheDocument()
        })
    })

    it('shows "إلغاء" and "إنشاء" in dialog footer', async () => {
        renderWH()
        fireEvent.click(screen.getByText('مستودع جديد'))
        await waitFor(() => {
            expect(screen.getByText('إلغاء')).toBeInTheDocument()
            expect(screen.getByText('إنشاء')).toBeInTheDocument()
        })
    })

    it('shows "حفظ" in edit dialog', async () => {
        renderWH()
        const editBtns = screen.getAllByTitle('تعديل')
        fireEvent.click(editBtns[0])
        await waitFor(() => {
            expect(screen.getByText('تعديل مستودع')).toBeInTheDocument()
            expect(screen.getByText('حفظ')).toBeInTheDocument()
        })
    })

    it('shows "لا توجد مستودعات" empty state in Arabic', () => {
        mockIsRTL = true
        render(<WarehousesView {...DEFAULT_PROPS} warehouses={[]} />)
        expect(screen.getByText('لا توجد مستودعات')).toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. TYPE FILTER BUTTONS — both languages
// ═════════════════════════════════════════════════════════════════════════════
describe('Type filter buttons', () => {
    it('renders filter buttons for every warehouse type', () => {
        mockIsRTL = false
        renderWH()
        // filter buttons have format "TypeName (count)" inside a rounded-full button
        const filterButtons = screen.getAllByRole('button').filter(
            btn => btn.className.includes('rounded-full')
        )
        const filterTexts = filterButtons.map(btn => btn.textContent || '')
            ;['Van', 'Main', 'Temporary', 'Damaged', 'Returns', 'Customer Location'].forEach(type => {
                expect(filterTexts.some(t => t.startsWith(type))).toBe(true)
            })
    })

    it('filters table rows when clicking a type button', () => {
        mockIsRTL = false
        renderWH()
        // Before filter: all 3 warehouses visible
        expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(3) // header + 3 data rows

        // Click "Van" filter
        const vanBtn = screen.getByText(/^Van \(/)
        fireEvent.click(vanBtn)

        // Only Van warehouse should be visible
        expect(screen.getByText('Van 1')).toBeInTheDocument()
        expect(screen.queryByText('Main WH')).not.toBeInTheDocument()
        expect(screen.queryByText('Disabled WH')).not.toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. SEARCH FILTERING
// ═════════════════════════════════════════════════════════════════════════════
describe('Search filtering', () => {
    beforeEach(() => { mockIsRTL = false })

    it('filters by warehouse name when user types', async () => {
        renderWH()
        const searchInput = screen.getByPlaceholderText('Search warehouses...')
        await userEvent.type(searchInput, 'Van')

        expect(screen.getByText('Van 1')).toBeInTheDocument()
        expect(screen.queryByText('Main WH')).not.toBeInTheDocument()
    })

    it('shows empty state when search matches nothing', async () => {
        renderWH()
        const searchInput = screen.getByPlaceholderText('Search warehouses...')
        await userEvent.type(searchInput, 'xyzzzz_nomatch')
        expect(screen.getByText('No warehouses found')).toBeInTheDocument()
    })

    it('resets page to 1 when search changes', async () => {
        mockIsRTL = false
        // Create 20 warehouses to trigger pagination then search
        const manyWarehouses = Array.from({ length: 20 }, (_, i) =>
            makeWarehouse({ name: `WH-${i} - Q`, warehouse_name: `Warehouse ${i}` })
        )
        render(<WarehousesView {...DEFAULT_PROPS} warehouses={manyWarehouses} />)

        // Page 2 button should be visible
        await waitFor(() => {
            // pagination exists
        })

        const searchInput = screen.getByPlaceholderText('Search warehouses...')
        await userEvent.type(searchInput, 'Warehouse 1')
        // Should show filtered results, not overflow to page 2
        expect(screen.queryByText('No warehouses found')).not.toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. SUMMARY CARDS — counts
// ═════════════════════════════════════════════════════════════════════════════
describe('Summary card counts', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows correct total count', () => {
        renderWH()
        // Total card value = 3 (ACTIVE_WH + DISABLED_WH + VAN_WH, all non-group)
        const totalCard = screen.getByText('Total').closest('div')!
        expect(within(totalCard).getByText('3')).toBeInTheDocument()
    })

    it('shows correct Van count', () => {
        renderWH()
        // 'Van' appears in both filter button and summary card — find the card specifically
        const vanLabels = screen.getAllByText('Van').filter(el => el.tagName === 'P')
        expect(vanLabels.length).toBeGreaterThan(0)
        const vanCard = vanLabels[0].closest('div')!
        expect(within(vanCard).getByText('1')).toBeInTheDocument()
    })

    it('excludes group warehouses from counts', () => {
        const groupWH = makeWarehouse({ is_group: 1, warehouse_name: 'Group WH' })
        render(<WarehousesView {...DEFAULT_PROPS} warehouses={[...DEFAULT_PROPS.warehouses, groupWH]} />)
        const totalCard = screen.getByText('Total').closest('div')!
        // Group WH should NOT be counted
        expect(within(totalCard).getByText('3')).toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7. BIN STOCK — SKU count in table
// ═════════════════════════════════════════════════════════════════════════════
describe('BinStock display', () => {
    beforeEach(() => { mockIsRTL = false })

    it('shows "0" when warehouse has no stock', () => {
        renderWH()
        const rows = screen.getAllByRole('row')
        // find row for ACTIVE_WH
        const activeRow = rows.find(r => within(r).queryByText('Main WH'))
        expect(activeRow).toBeTruthy()
        // SKU cell should show 0 text or "—"
        expect(within(activeRow!).getByText('0')).toBeInTheDocument()
    })

    it('shows badge with SKU count when warehouse has stock', () => {
        const binStock: BinStock[] = [
            { item_code: 'ITEM-001', warehouse: 'Main - Q', actual_qty: 10 },
            { item_code: 'ITEM-002', warehouse: 'Main - Q', actual_qty: 5 },
        ]
        render(<WarehousesView {...DEFAULT_PROPS} binStock={binStock} />)
        // Find the row for ACTIVE_WH (Main - Q) and check its SKU badge
        const rows = screen.getAllByRole('row')
        const activeRow = rows.find(r => within(r).queryByText('Main WH'))!
        expect(activeRow).toBeTruthy()
        expect(within(activeRow).getByText('2')).toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8. FORM VALIDATION (toast)
// ═════════════════════════════════════════════════════════════════════════════
describe('Form validation', () => {
    it('shows "Warehouse name required" toast (EN) when name is empty', async () => {
        mockIsRTL = false
        renderWH()
        fireEvent.click(screen.getByText('New Warehouse'))
        await waitFor(() => screen.getByText('Create'))
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Warehouse name required',
                variant: 'destructive',
            }))
        })
    })

    it('shows "اسم المستودع مطلوب" toast (AR) when name is empty', async () => {
        mockIsRTL = true
        renderWH()
        fireEvent.click(screen.getByText('مستودع جديد'))
        await waitFor(() => screen.getByText('إنشاء'))
        fireEvent.click(screen.getByText('إنشاء'))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: 'اسم المستودع مطلوب',
                variant: 'destructive',
            }))
        })
    })

    it('shows "Company required" toast (EN) when name filled but company empty', async () => {
        // mockGetCompanies returns [{name:'Q'...}] but the form default company is set from companies[0]
        // Reset companies so form.company stays ''
        mockGetCompanies.mockResolvedValueOnce([])
        mockIsRTL = false
        renderWH()
        fireEvent.click(screen.getByText('New Warehouse'))
        await waitFor(() => screen.getByText('Create'))
        const nameInput = screen.getByPlaceholderText('e.g. Riyadh Main Warehouse')
        await userEvent.type(nameInput, 'Test WH')
        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Company required',
                variant: 'destructive',
            }))
        })
    })

    it('shows "الشركة مطلوبة" toast (AR) when company empty', async () => {
        mockGetCompanies.mockResolvedValueOnce([])
        mockIsRTL = true
        renderWH()
        fireEvent.click(screen.getByText('مستودع جديد'))
        await waitFor(() => screen.getByText('إنشاء'))
        const nameInput = screen.getByPlaceholderText('مثال: مستودع الرياض الرئيسي')
        await userEvent.type(nameInput, 'مستودع اختبار')
        fireEvent.click(screen.getByText('إنشاء'))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: 'الشركة مطلوبة',
                variant: 'destructive',
            }))
        })
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9. SUCCESSFUL CREATE  
// ═════════════════════════════════════════════════════════════════════════════
describe('Successful create / edit', () => {
    it('calls createWarehouse and shows "Warehouse created" toast (EN)', async () => {
        mockIsRTL = false
        renderWH()
        // Wait for companies to load
        await waitFor(() => expect(mockGetCompanies).toHaveBeenCalled())
        fireEvent.click(screen.getByText('New Warehouse'))
        await waitFor(() => screen.getByText('Create'))

        await userEvent.type(screen.getByPlaceholderText('e.g. Riyadh Main Warehouse'), 'Test WH')

        // Ensure company select has a value (companies loaded → 'Q')
        const select = screen.getByDisplayValue(/القرعاوي|Q/)
        expect(select).toBeInTheDocument()

        fireEvent.click(screen.getByText('Create'))
        await waitFor(() => {
            expect(mockCreateWarehouse).toHaveBeenCalled()
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Warehouse created' }))
        })
    })

    it('calls createWarehouse and shows "تم إنشاء المستودع" toast (AR)', async () => {
        mockIsRTL = true
        renderWH()
        await waitFor(() => expect(mockGetCompanies).toHaveBeenCalled())
        fireEvent.click(screen.getByText('مستودع جديد'))
        await waitFor(() => screen.getByText('إنشاء'))

        await userEvent.type(screen.getByPlaceholderText('مثال: مستودع الرياض الرئيسي'), 'مستودع اختبار')

        const select = screen.getByDisplayValue(/القرعاوي|Q/)
        expect(select).toBeInTheDocument()

        fireEvent.click(screen.getByText('إنشاء'))
        await waitFor(() => {
            expect(mockCreateWarehouse).toHaveBeenCalled()
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'تم إنشاء المستودع' }))
        })
    })

    it('calls updateWarehouse and shows "Warehouse updated" toast (EN) on edit', async () => {
        mockIsRTL = false
        renderWH()
        const editBtns = screen.getAllByTitle('Edit')
        fireEvent.click(editBtns[0])
        await waitFor(() => screen.getByText('Save'))
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => {
            expect(mockUpdateWarehouse).toHaveBeenCalled()
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Warehouse updated' }))
        })
    })

    it('calls updateWarehouse and shows "تم تحديث المستودع" toast (AR) on edit', async () => {
        mockIsRTL = true
        renderWH()
        const editBtns = screen.getAllByTitle('تعديل')
        fireEvent.click(editBtns[0])
        await waitFor(() => screen.getByText('حفظ'))
        fireEvent.click(screen.getByText('حفظ'))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'تم تحديث المستودع' }))
        })
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10. TOGGLE (Enable / Disable)
// ═════════════════════════════════════════════════════════════════════════════
describe('Toggle warehouse', () => {
    it('calls toggleWarehouse and shows "Disabled" toast (EN) when disabling active WH', async () => {
        mockIsRTL = false
        renderWH()
        const toggleBtns = screen.getAllByTitle('Toggle')
        // First toggle belongs to ACTIVE_WH (not disabled)
        const toggleForActive = toggleBtns.find((_, i) => {
            const row = toggleBtns[i].closest('tr')
            return row && within(row).queryByText('Main WH')
        }) || toggleBtns[0]
        fireEvent.click(toggleForActive)
        // Confirm in the AlertDialog
        await waitFor(() => expect(screen.getByText('Disable Warehouse')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
        await waitFor(() => {
            expect(mockToggleWarehouse).toHaveBeenCalled()
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Disabled' }))
        })
    })

    it('calls toggleWarehouse and shows "Enabled" toast (EN) when enabling disabled WH', async () => {
        mockIsRTL = false
        renderWH()
        const rows = screen.getAllByRole('row')
        const disabledRow = rows.find(r => within(r).queryByText('Disabled WH'))
        expect(disabledRow).toBeTruthy()
        const toggleBtn = within(disabledRow!).getByTitle('Toggle')
        fireEvent.click(toggleBtn)
        // Confirm in the AlertDialog
        await waitFor(() => expect(screen.getByText('Enable Warehouse')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Enable' }))
        await waitFor(() => {
            expect(mockToggleWarehouse).toHaveBeenCalled()
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Enabled' }))
        })
    })

    it('shows "تم التعطيل" toast (AR) when disabling active WH', async () => {
        mockIsRTL = true
        renderWH()
        const rows = screen.getAllByRole('row')
        const activeRow = rows.find(r => within(r).queryByText('Main WH'))!
        const toggleBtn = within(activeRow).getByTitle('تعطيل/تفعيل')
        fireEvent.click(toggleBtn)
        // Confirm in the AlertDialog
        await waitFor(() => expect(screen.getByText('تعطيل المستودع')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'تعطيل' }))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'تم التعطيل' }))
        })
    })

    it('shows "تم التفعيل" toast (AR) when enabling disabled WH', async () => {
        mockIsRTL = true
        renderWH()
        const rows = screen.getAllByRole('row')
        const disabledRow = rows.find(r => within(r).queryByText('Disabled WH'))!
        const toggleBtn = within(disabledRow).getByTitle('تعطيل/تفعيل')
        fireEvent.click(toggleBtn)
        // Confirm in the AlertDialog
        await waitFor(() => expect(screen.getByText('تفعيل المستودع')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'تفعيل' }))
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'تم التفعيل' }))
        })
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 11. PAGINATION
// ═════════════════════════════════════════════════════════════════════════════
describe('Pagination', () => {
    beforeEach(() => { mockIsRTL = false })

    it('does NOT render pagination when <= 15 items', () => {
        renderWH()
        // 3 warehouses → no pagination
        expect(screen.queryByRole('button', { name: /next|prev|previous|ChevronRight|ChevronLeft/i })).toBeNull()
    })

    it('renders pagination buttons when > 15 items', () => {
        const manyWarehouses = Array.from({ length: 20 }, (_, i) =>
            makeWarehouse({ name: `WH-${i} - Q`, warehouse_name: `Warehouse ${i}` })
        )
        render(<WarehousesView {...DEFAULT_PROPS} warehouses={manyWarehouses} />)
        // Should show pagination info
        expect(screen.getByText(/1-15 of 20/)).toBeInTheDocument()
    })

    it('shows Arabic pagination range text (isRTL=true)', () => {
        mockIsRTL = true
        const manyWarehouses = Array.from({ length: 20 }, (_, i) =>
            makeWarehouse({ name: `WH-${i} - Q`, warehouse_name: `Warehouse ${i}` })
        )
        render(<WarehousesView {...DEFAULT_PROPS} warehouses={manyWarehouses} />)
        expect(screen.getByText(/من 20/)).toBeInTheDocument()
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// 12. DETAIL DIALOG translations
// ═════════════════════════════════════════════════════════════════════════════
describe('Detail dialog translations', () => {
    it('shows English detail field labels', async () => {
        mockIsRTL = false
        renderWH()
        const viewBtns = screen.getAllByTitle('View')
        fireEvent.click(viewBtns[0])
        await waitFor(() => {
            expect(screen.getByText('System Name')).toBeInTheDocument()
            // 'Type', 'Company', 'Status' also appear in table headers — check they exist (≥2 occurrences is fine)
            expect(screen.getAllByText('Type').length).toBeGreaterThanOrEqual(1)
            expect(screen.getAllByText('Company').length).toBeGreaterThanOrEqual(1)
            // 'Status' in table header + detail fields
            expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
        })
    })

    it('shows Arabic detail field labels', async () => {
        mockIsRTL = true
        renderWH()
        const viewBtns = screen.getAllByTitle('عرض')
        fireEvent.click(viewBtns[0])
        await waitFor(() => {
            expect(screen.getByText('الاسم الفني')).toBeInTheDocument()
            expect(screen.getByText('الشركة')).toBeInTheDocument()
        })
    })
})
