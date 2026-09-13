/**
 * Purchase Management API Client
 * Connects to ERPNext Buying / Stock / Accounts doctypes + custom base_meena helpers
 */

import { frappeClient, type FrappeRequestOptions, type FrappeFilter } from './api-client'

// ==================== Types ====================

export interface Supplier {
    name: string
    supplier_name: string
    supplier_group?: string
    supplier_type?: string
    country?: string
    default_currency?: string
    default_bank_account?: string
    tax_id?: string
    tax_category?: string
    is_internal_supplier?: number
    disabled?: number
    image?: string
    language?: string
    payment_terms?: string
    // Address / Contact (from child tables, flattened in queries)
    primary_address?: string
    mobile_no?: string
    email_id?: string
    website?: string
    company?: string
    creation?: string
    modified?: string
}

export interface SupplierGroup {
    name: string
    is_group?: number
    parent_supplier_group?: string
}

export interface PurchaseOrderItem {
    name?: string
    item_code: string
    item_name?: string
    description?: string
    qty: number
    rate: number
    amount?: number
    uom?: string
    stock_uom?: string
    conversion_factor?: number
    warehouse?: string
    schedule_date?: string
    received_qty?: number
    billed_amt?: number
    image?: string
    material_request?: string
    material_request_item?: string
}

export interface PurchaseOrder {
    name: string
    title?: string
    supplier: string
    supplier_name?: string
    company: string
    transaction_date: string
    schedule_date?: string
    status?: string
    grand_total?: number
    net_total?: number
    total_qty?: number
    currency?: string
    conversion_rate?: number
    payment_terms_template?: string
    tc_name?: string
    items?: PurchaseOrderItem[]
    taxes?: PurchaseTax[]
    docstatus?: number
    per_received?: number
    per_billed?: number
    creation?: string
    modified?: string
}

export interface PurchaseTax {
    charge_type?: string
    account_head?: string
    description?: string
    rate?: number
    tax_amount?: number
    total?: number
}

export interface PurchaseReceiptItem {
    name?: string
    item_code: string
    item_name?: string
    qty: number
    received_qty?: number
    rate?: number
    amount?: number
    uom?: string
    stock_uom?: string
    warehouse?: string
    purchase_order?: string
    purchase_order_item?: string
    batch_no?: string
    serial_no?: string
    rejected_qty?: number
}

export interface PurchaseReceipt {
    name: string
    supplier: string
    supplier_name?: string
    company: string
    posting_date: string
    posting_time?: string
    status?: string
    grand_total?: number
    total_qty?: number
    items?: PurchaseReceiptItem[]
    docstatus?: number
    is_return?: number
    per_billed?: number
    creation?: string
    modified?: string
}

export interface PurchaseInvoiceItem {
    name?: string
    item_code: string
    item_name?: string
    qty: number
    rate: number
    amount?: number
    uom?: string
    warehouse?: string
    purchase_order?: string
    purchase_receipt?: string
    expense_account?: string
}

export interface PurchaseInvoice {
    name: string
    supplier: string
    supplier_name?: string
    company: string
    posting_date: string
    due_date?: string
    status?: string
    grand_total?: number
    outstanding_amount?: number
    total_qty?: number
    items?: PurchaseInvoiceItem[]
    taxes?: PurchaseTax[]
    docstatus?: number
    is_paid?: number
    is_return?: number
    creation?: string
    modified?: string
}

export interface MaterialRequestItem {
    name?: string
    item_code: string
    item_name?: string
    qty: number
    uom?: string
    stock_uom?: string
    warehouse?: string
    schedule_date?: string
    description?: string
}

export interface MaterialRequest {
    name: string
    company: string
    material_request_type: string
    transaction_date: string
    schedule_date?: string
    status?: string
    title?: string
    items?: MaterialRequestItem[]
    docstatus?: number
    per_ordered?: number
    creation?: string
    modified?: string
}

export interface PurchaseItem {
    name: string
    item_code?: string
    item_name: string
    item_group?: string
    stock_uom?: string
    description?: string
    standard_rate?: number
    image?: string
    has_batch_no?: number
    has_serial_no?: number
    last_purchase_rate?: number | null
}

export interface ItemGroup {
    name: string
    is_group?: number
    parent_item_group?: string
}

export interface PaymentTermsTemplate {
    name: string
    template_name?: string
}

export interface PurchaseDashboard {
    suppliers: number
    purchase_orders: number
    pending_orders: number
    purchase_receipts: number
    purchase_invoices: number
    material_requests: number
    total_purchase_value: number
    monthly_trend: Array<{ month: string; count: number; total: number }>
    top_suppliers: Array<{ supplier: string; supplier_name: string; order_count: number; total_amount: number }>
}

// ==================== API ====================

export const purchaseApi = {

    // ──────────────────────── Dashboard ────────────────────────

    async getDashboard(company?: string): Promise<PurchaseDashboard> {
        const resp = await frappeClient.call<PurchaseDashboard>(
            'base_meena.purchase_management.purchase_api.get_purchase_dashboard',
            { company }
        )
        return resp.message || resp.data || ({} as PurchaseDashboard)
    },

    // ──────────────────────── Suppliers ────────────────────────

    async getSuppliers(options?: FrappeRequestOptions & { company?: string; group?: string; disabled?: boolean }): Promise<Supplier[]> {
        const { company, group, disabled, ...rest } = options || {}
        const filters: FrappeFilter[] = []
        if (group) filters.push(['Supplier', 'supplier_group', '=', group])
        if (disabled !== undefined) filters.push(['Supplier', 'disabled', '=', disabled ? 1 : 0])
        else filters.push(['Supplier', 'disabled', '=', 0])

        return frappeClient.getList<Supplier>('Supplier', {
            filters,
            fields: [
                'name', 'supplier_name', 'supplier_group', 'supplier_type',
                'country', 'default_currency', 'tax_id', 'disabled',
                'image', 'language', 'payment_terms', 'mobile_no', 'email_id',
                'creation', 'modified',
            ],
            order_by: 'supplier_name asc',
            limit_page_length: 500,
            ...rest,
        })
    },

    async getSupplier(name: string): Promise<Supplier> {
        const res = await frappeClient.get<Supplier>('Supplier', name)
        if (!res.data) throw new Error('Supplier not found')
        return res.data
    },

    async createSupplier(data: Partial<Supplier>): Promise<Supplier> {
        const res = await frappeClient.post<Supplier>('Supplier', data)
        if (!res.data) throw new Error('Failed to create supplier')
        return res.data
    },

    async updateSupplier(name: string, data: Partial<Supplier>): Promise<Supplier> {
        const res = await frappeClient.put<Supplier>('Supplier', name, data)
        if (!res.data) throw new Error('Failed to update supplier')
        return res.data
    },

    async deleteSupplier(name: string): Promise<void> {
        await frappeClient.delete('Supplier', name)
    },

    async toggleSupplier(name: string, disabled: boolean): Promise<Supplier> {
        const res = await frappeClient.put<Supplier>('Supplier', name, { disabled: disabled ? 1 : 0 })
        if (!res.data) throw new Error('Failed to toggle supplier')
        return res.data
    },

    // ──────────────────────── Supplier Groups ────────────────────────

    async getSupplierGroups(): Promise<SupplierGroup[]> {
        const resp = await frappeClient.call<SupplierGroup[]>(
            'base_meena.purchase_management.purchase_api.get_supplier_groups'
        )
        return resp.message || resp.data || []
    },

    // ──────────────────────── Purchase Orders ────────────────────────

    async getPurchaseOrders(options?: FrappeRequestOptions & {
        company?: string; supplier?: string; status?: string
    }): Promise<PurchaseOrder[]> {
        const { company, supplier, status, ...rest } = options || {}
        const filters: FrappeFilter[] = []
        if (company) filters.push(['Purchase Order', 'company', '=', company])
        if (supplier) filters.push(['Purchase Order', 'supplier', '=', supplier])
        if (status) filters.push(['Purchase Order', 'status', '=', status])

        return frappeClient.getList<PurchaseOrder>('Purchase Order', {
            filters,
            fields: [
                'name', 'title', 'supplier', 'supplier_name', 'company',
                'transaction_date', 'schedule_date', 'status',
                'grand_total', 'net_total', 'total_qty', 'currency',
                'per_received', 'per_billed', 'docstatus',
                'creation', 'modified',
            ],
            order_by: 'transaction_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async getPurchaseOrder(name: string): Promise<PurchaseOrder> {
        const res = await frappeClient.get<PurchaseOrder>('Purchase Order', name)
        if (!res.data) throw new Error('Purchase Order not found')
        return res.data
    },

    async createPurchaseOrder(data: {
        supplier: string
        company: string
        transaction_date: string
        schedule_date?: string
        currency?: string
        payment_terms_template?: string
        items: Array<{
            item_code: string
            qty: number
            rate: number
            uom?: string
            warehouse?: string
            schedule_date?: string
        }>
    }): Promise<PurchaseOrder> {
        const res = await frappeClient.post<PurchaseOrder>('Purchase Order', data)
        if (!res.data) throw new Error('Failed to create Purchase Order')
        return res.data
    },

    async updatePurchaseOrder(name: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
        const res = await frappeClient.put<PurchaseOrder>('Purchase Order', name, data)
        if (!res.data) throw new Error('Failed to update Purchase Order')
        return res.data
    },

    async submitPurchaseOrder(name: string): Promise<PurchaseOrder> {
        const docRes = await frappeClient.get<PurchaseOrder>('Purchase Order', name)
        const doc = docRes.data
        if (!doc) throw new Error('Purchase Order not found: ' + name)
        const resp = await frappeClient.call<PurchaseOrder>('frappe.client.submit', { doc: { ...doc, doctype: 'Purchase Order' } })
        return resp.message || resp.data || doc
    },

    async cancelPurchaseOrder(name: string): Promise<PurchaseOrder> {
        const resp = await frappeClient.call<PurchaseOrder>('frappe.client.cancel', { doctype: 'Purchase Order', name })
        return resp.message || resp.data || ({} as PurchaseOrder)
    },

    async deletePurchaseOrder(name: string): Promise<void> {
        await frappeClient.delete('Purchase Order', name)
    },

    // ──────────────────────── Purchase Receipts ────────────────────────

    async getPurchaseReceipts(options?: FrappeRequestOptions & {
        company?: string; supplier?: string; status?: string
    }): Promise<PurchaseReceipt[]> {
        const { company, supplier, status, ...rest } = options || {}
        const filters: FrappeFilter[] = []
        if (company) filters.push(['Purchase Receipt', 'company', '=', company])
        if (supplier) filters.push(['Purchase Receipt', 'supplier', '=', supplier])
        if (status) filters.push(['Purchase Receipt', 'status', '=', status])

        return frappeClient.getList<PurchaseReceipt>('Purchase Receipt', {
            filters,
            fields: [
                'name', 'supplier', 'supplier_name', 'company',
                'posting_date', 'posting_time', 'status',
                'grand_total', 'total_qty', 'is_return',
                'per_billed', 'docstatus', 'creation', 'modified',
            ],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async getPurchaseReceipt(name: string): Promise<PurchaseReceipt> {
        const res = await frappeClient.get<PurchaseReceipt>('Purchase Receipt', name)
        if (!res.data) throw new Error('Purchase Receipt not found')
        return res.data
    },

    async createPurchaseReceipt(data: {
        supplier: string
        company: string
        posting_date?: string
        items: Array<{
            item_code: string
            qty: number
            rate?: number
            warehouse?: string
            purchase_order?: string
            purchase_order_item?: string
            batch_no?: string
            serial_no?: string
        }>
    }): Promise<PurchaseReceipt> {
        const res = await frappeClient.post<PurchaseReceipt>('Purchase Receipt', data)
        if (!res.data) throw new Error('Failed to create Purchase Receipt')
        return res.data
    },

    async submitPurchaseReceipt(name: string): Promise<PurchaseReceipt> {
        const docRes = await frappeClient.get<PurchaseReceipt>('Purchase Receipt', name)
        const doc = docRes.data
        if (!doc) throw new Error('Purchase Receipt not found: ' + name)
        const resp = await frappeClient.call<PurchaseReceipt>('frappe.client.submit', { doc: { ...doc, doctype: 'Purchase Receipt' } })
        return resp.message || resp.data || doc
    },

    async cancelPurchaseReceipt(name: string): Promise<PurchaseReceipt> {
        const resp = await frappeClient.call<PurchaseReceipt>('frappe.client.cancel', { doctype: 'Purchase Receipt', name })
        return resp.message || resp.data || ({} as PurchaseReceipt)
    },

    // ──────────────────────── Purchase Invoices ────────────────────────

    async getPurchaseInvoices(options?: FrappeRequestOptions & {
        company?: string; supplier?: string; status?: string
    }): Promise<PurchaseInvoice[]> {
        const { company, supplier, status, ...rest } = options || {}
        const filters: FrappeFilter[] = []
        if (company) filters.push(['Purchase Invoice', 'company', '=', company])
        if (supplier) filters.push(['Purchase Invoice', 'supplier', '=', supplier])
        if (status) filters.push(['Purchase Invoice', 'status', '=', status])

        return frappeClient.getList<PurchaseInvoice>('Purchase Invoice', {
            filters,
            fields: [
                'name', 'supplier', 'supplier_name', 'company',
                'posting_date', 'due_date', 'status',
                'grand_total', 'outstanding_amount', 'total_qty',
                'is_paid', 'is_return', 'docstatus', 'creation', 'modified',
            ],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async getPurchaseInvoice(name: string): Promise<PurchaseInvoice> {
        const res = await frappeClient.get<PurchaseInvoice>('Purchase Invoice', name)
        if (!res.data) throw new Error('Purchase Invoice not found')
        return res.data
    },

    async createPurchaseInvoice(data: {
        supplier: string
        company: string
        posting_date?: string
        due_date?: string
        items: Array<{
            item_code: string
            qty: number
            rate: number
            warehouse?: string
            purchase_order?: string
            purchase_receipt?: string
            expense_account?: string
        }>
    }): Promise<PurchaseInvoice> {
        const res = await frappeClient.post<PurchaseInvoice>('Purchase Invoice', data)
        if (!res.data) throw new Error('Failed to create Purchase Invoice')
        return res.data
    },

    async submitPurchaseInvoice(name: string): Promise<PurchaseInvoice> {
        const docRes = await frappeClient.get<PurchaseInvoice>('Purchase Invoice', name)
        const doc = docRes.data
        if (!doc) throw new Error('Purchase Invoice not found: ' + name)
        const resp = await frappeClient.call<PurchaseInvoice>('frappe.client.submit', { doc: { ...doc, doctype: 'Purchase Invoice' } })
        return resp.message || resp.data || doc
    },

    async cancelPurchaseInvoice(name: string): Promise<PurchaseInvoice> {
        const resp = await frappeClient.call<PurchaseInvoice>('frappe.client.cancel', { doctype: 'Purchase Invoice', name })
        return resp.message || resp.data || ({} as PurchaseInvoice)
    },

    // ──────────────────────── Material Requests ────────────────────────

    async getMaterialRequests(options?: FrappeRequestOptions & {
        company?: string; status?: string; type?: string
    }): Promise<MaterialRequest[]> {
        const { company, status, type, ...rest } = options || {}
        const filters: FrappeFilter[] = [
            ['Material Request', 'material_request_type', '=', type || 'Purchase'],
        ]
        if (company) filters.push(['Material Request', 'company', '=', company])
        if (status) filters.push(['Material Request', 'status', '=', status])

        return frappeClient.getList<MaterialRequest>('Material Request', {
            filters,
            fields: [
                'name', 'company', 'material_request_type',
                'transaction_date', 'schedule_date', 'status', 'title',
                'per_ordered', 'docstatus', 'creation', 'modified',
            ],
            order_by: 'transaction_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async getMaterialRequest(name: string): Promise<MaterialRequest> {
        const res = await frappeClient.get<MaterialRequest>('Material Request', name)
        if (!res.data) throw new Error('Material Request not found')
        return res.data
    },

    async createMaterialRequest(data: {
        company: string
        material_request_type?: string
        transaction_date?: string
        schedule_date?: string
        items: Array<{
            item_code: string
            qty: number
            uom?: string
            warehouse?: string
            schedule_date?: string
        }>
    }): Promise<MaterialRequest> {
        const res = await frappeClient.post<MaterialRequest>('Material Request', {
            material_request_type: 'Purchase',
            ...data,
        })
        if (!res.data) throw new Error('Failed to create Material Request')
        return res.data
    },

    async submitMaterialRequest(name: string): Promise<MaterialRequest> {
        const docRes = await frappeClient.get<MaterialRequest>('Material Request', name)
        const doc = docRes.data
        if (!doc) throw new Error('Material Request not found: ' + name)
        const resp = await frappeClient.call<MaterialRequest>('frappe.client.submit', { doc: { ...doc, doctype: 'Material Request' } })
        return resp.message || resp.data || doc
    },

    async cancelMaterialRequest(name: string): Promise<MaterialRequest> {
        const resp = await frappeClient.call<MaterialRequest>('frappe.client.cancel', { doctype: 'Material Request', name })
        return resp.message || resp.data || ({} as MaterialRequest)
    },

    async convertMRtoPO(materialRequest: string, supplier?: string): Promise<PurchaseOrder> {
        const resp = await frappeClient.call<PurchaseOrder>(
            'base_meena.purchase_management.purchase_api.create_po_from_material_request',
            { material_request: materialRequest, supplier }
        )
        return resp.message || resp.data || ({} as PurchaseOrder)
    },

    // ──────────────────────── Helpers ────────────────────────

    async getPurchaseItems(supplier?: string, itemGroup?: string, company?: string): Promise<PurchaseItem[]> {
        const resp = await frappeClient.call<PurchaseItem[]>(
            'base_meena.purchase_management.purchase_api.get_purchase_items',
            { supplier, item_group: itemGroup, company }
        )
        return resp.message || resp.data || []
    },

    async getItemGroups(): Promise<ItemGroup[]> {
        const resp = await frappeClient.call<ItemGroup[]>(
            'base_meena.purchase_management.purchase_api.get_item_groups'
        )
        return resp.message || resp.data || []
    },

    async getPaymentTermsTemplates(): Promise<PaymentTermsTemplate[]> {
        const resp = await frappeClient.call<PaymentTermsTemplate[]>(
            'base_meena.purchase_management.purchase_api.get_payment_terms_templates'
        )
        return resp.message || resp.data || []
    },

    /** Get modes of payment */
    async getModesOfPayment(): Promise<Array<{ name: string }>> {
        const resp = await frappeClient.call<Array<{ name: string }>>(
            'base_meena.purchase_management.purchase_api.get_modes_of_payment'
        )
        return resp.message || resp.data || []
    },

    /** Create and submit a Payment Entry against a Purchase Invoice */
    async makePaymentEntry(data: {
        invoice_name: string
        amount: number
        mode_of_payment?: string
        reference_no?: string
        reference_date?: string
        posting_date?: string
    }): Promise<{ name: string; paid_amount: number; status: string }> {
        const resp = await frappeClient.call<{ name: string; paid_amount: number; status: string }>(
            'base_meena.purchase_management.purchase_api.make_payment_entry',
            data
        )
        return resp.message || resp.data || { name: '', paid_amount: 0, status: '' }
    },

    /** Get warehouses for receipt destination */
    async getWarehouses(company?: string): Promise<Array<{ name: string; warehouse_name: string }>> {
        const filters: FrappeFilter[] = [
            ['Warehouse', 'is_group', '=', 0],
            ['Warehouse', 'disabled', '=', 0],
        ]
        if (company) filters.push(['Warehouse', 'company', '=', company])
        return frappeClient.getList('Warehouse', {
            filters,
            fields: ['name', 'warehouse_name'],
            order_by: 'warehouse_name asc',
            limit_page_length: 200,
        })
    },

    /** Get companies */
    async getCompanies(): Promise<Array<{ name: string; company_name: string; default_currency: string }>> {
        return frappeClient.getList('Company', {
            fields: ['name', 'company_name', 'default_currency'],
            order_by: 'name asc',
            limit_page_length: 50,
        })
    },

    // ──────────────────────── Stock Reconciliation (جرد) ────────────────────────

    async getStockReconciliations(options?: FrappeRequestOptions & {
        company?: string
    }): Promise<Array<{
        name: string; company: string; posting_date: string; posting_time?: string;
        purpose: string; status?: string; docstatus?: number; creation?: string; modified?: string
    }>> {
        const { company, ...rest } = options || {}
        const filters: FrappeFilter[] = []
        if (company) filters.push(['Stock Reconciliation', 'company', '=', company])
        return frappeClient.getList('Stock Reconciliation', {
            filters,
            fields: ['name', 'company', 'posting_date', 'posting_time', 'purpose', 'docstatus', 'creation', 'modified'],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async createStockReconciliation(data: {
        company: string
        posting_date?: string
        purpose?: string
        items: Array<{
            item_code: string
            warehouse: string
            qty: number
            valuation_rate?: number
        }>
    }): Promise<{ name: string }> {
        const res = await frappeClient.post<{ name: string }>('Stock Reconciliation', {
            purpose: 'Stock Reconciliation',
            ...data,
        })
        if (!res.data) throw new Error('Failed to create Stock Reconciliation')
        return res.data
    },

    async submitStockReconciliation(name: string): Promise<{ name: string }> {
        const docRes = await frappeClient.get<{ name: string }>('Stock Reconciliation', name)
        const doc = docRes.data
        if (!doc) throw new Error('Stock Reconciliation not found: ' + name)
        const resp = await frappeClient.call<{ name: string }>('frappe.client.submit', { doc: { ...doc, doctype: 'Stock Reconciliation' } })
        return resp.message || resp.data || doc
    },

    /** Get available Units of Measure */
    async getUOMs(): Promise<Array<{ name: string }>> {
        return frappeClient.getList('UOM', {
            fields: ['name'],
            order_by: 'name asc',
            limit_page_length: 500,
        })
    },

    /** Create a new UOM */
    async createUOM(name: string): Promise<{ name: string }> {
        const res = await frappeClient.post<{ name: string }>('UOM', { uom_name: name })
        if (!res.data) throw new Error('Failed to create UOM')
        return res.data
    },

    /** Get item valuation rate (last purchase rate) */
    async getItemValuation(itemCode: string, warehouse?: string): Promise<number> {
        try {
            const bins = await frappeClient.getList('Bin', {
                filters: [
                    ['Bin', 'item_code', '=', itemCode],
                    ...(warehouse ? [['Bin', 'warehouse', '=', warehouse] as FrappeFilter] : []),
                ],
                fields: ['valuation_rate', 'actual_qty'],
                limit_page_length: 1,
            })
            if (bins.length > 0 && bins[0].valuation_rate) return bins[0].valuation_rate
        } catch { /* fallback below */ }
        // Fallback: get from item default
        try {
            const item = await frappeClient.get<{ valuation_rate?: number; standard_rate?: number; last_purchase_rate?: number }>('Item', itemCode)
            return item.data?.last_purchase_rate || item.data?.valuation_rate || item.data?.standard_rate || 0
        } catch { return 0 }
    },

    // ──────────────────────── Auto Repeat (Scheduled Orders) ────────────────────────

    async createAutoRepeat(data: {
        reference_doctype: string
        reference_document: string
        frequency: string
        start_date: string
        end_date?: string
        submit_on_creation?: number
    }): Promise<{ name: string }> {
        const res = await frappeClient.post<{ name: string }>('Auto Repeat', {
            ...data,
            submit_on_creation: data.submit_on_creation ?? 1,
        })
        if (!res.data) throw new Error('Failed to create Auto Repeat')
        return res.data
    },

    async getAutoRepeats(refDoctype: string, refDocument?: string): Promise<Array<{
        name: string; reference_doctype: string; reference_document: string
        frequency: string; start_date: string; end_date?: string; status: string; next_schedule_date?: string; disabled?: number
    }>> {
        const filters: FrappeFilter[] = [
            ['Auto Repeat', 'reference_doctype', '=', refDoctype],
        ]
        if (refDocument) filters.push(['Auto Repeat', 'reference_document', '=', refDocument])
        return frappeClient.getList('Auto Repeat', {
            filters,
            fields: ['name', 'reference_doctype', 'reference_document', 'frequency', 'start_date', 'end_date', 'status', 'next_schedule_date', 'disabled'],
            order_by: 'creation desc',
            limit_page_length: 100,
        })
    },

    async disableAutoRepeat(name: string): Promise<void> {
        await frappeClient.put('Auto Repeat', name, { disabled: 1 })
    },
}
