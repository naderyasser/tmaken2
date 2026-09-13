/**
 * Stock Management API Client
 * Connects to base_meena stock_management module on Frappe backend
 */

import { frappeClient, type FrappeRequestOptions, type FrappeFilter } from './api-client'

function escapeLike(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// ==================== Types ====================

export interface Warehouse {
    name: string
    warehouse_name: string
    custom_warehouse_type?: 'Main' | 'Van' | 'Customer Location' | 'Temporary' | 'Damaged' | 'Returns'
    custom_is_dynamic?: number
    custom_linked_sales_person?: string
    custom_linked_customer?: string
    /** JSON array string: stored as "[\"Customer A\", \"Customer B\"]" */
    custom_linked_customers?: string
    custom_gps_lat?: string
    custom_gps_lng?: string
    is_group?: number
    company?: string
    parent_warehouse?: string
    disabled?: number
}

export interface StockStatus {
    name: string
    status_name: string
    status_code: string
    color?: string
    is_sellable?: number
    enabled?: number
    description?: string
}

export interface StockMovementAudit {
    name: string
    movement_date: string
    movement_time?: string
    item_code: string
    warehouse: string
    batch_no?: string
    quantity_change: number
    previous_qty: number
    new_qty: number
    movement_type: 'In' | 'Out' | 'Transfer'
    reference_doctype?: string
    reference_name?: string
    user?: string
    ip_address?: string
    action?: 'Create' | 'Submit' | 'Cancel'
    creation?: string
}

export interface StockTransferRequest {
    name: string
    request_date: string
    from_warehouse: string
    to_warehouse: string
    sales_person?: string
    status: 'Pending' | 'Accepted' | 'Partially Accepted' | 'Rejected' | 'Completed'
    total_quantity?: number
    items?: StockTransferRequestItem[]
    accepted_by?: string
    accepted_date?: string
    rejection_reason?: string
    stock_entry?: string
    docstatus?: number
    creation?: string
}

export interface StockTransferRequestItem {
    item_code: string
    item_name?: string
    requested_qty: number
    accepted_qty?: number
    uom?: string
    batch_no?: string
    serial_no?: string
}

export interface ReturnLog {
    name: string
    return_date: string
    warehouse: string
    sales_person?: string
    customer?: string
    return_reason?: string
    total_quantity?: number
    total_value?: number
    status?: 'Draft' | 'Submitted' | 'Cancelled'
    stock_entry?: string
    items?: ReturnLogItem[]
    docstatus?: number
    creation?: string
}

export interface ReturnLogItem {
    item_code: string
    item_name?: string
    quantity: number
    rate?: number
    amount?: number
    uom?: string
    batch_no?: string
    serial_no?: string
    stock_status?: string
}

export interface BinStock {
    item_code: string
    item_name?: string
    warehouse: string
    actual_qty: number
    stock_uom?: string
    valuation_rate?: number
    stock_value?: number
}

export interface SalesPersonStockSummary {
    sales_person: string
    warehouse: string
    items: BinStock[]
}

/** Enriched stock item returned by getSalesPersonStock, includes batch/serial breakdown */
export interface SalesPersonStockItem extends BinStock {
    has_batch_no?: number
    has_serial_no?: number
    batches?: Array<{
        batch_no: string
        qty: number
        expiry_date?: string
        stock_status?: string
    }>
    /** Serial No records — each object contains name, serial_no, batch_no, warranty_expiry_date */
    serial_numbers?: Array<{
        name: string
        serial_no?: string
        batch_no?: string
        warranty_expiry_date?: string
    }>
}

export interface SalesPerson {
    name: string
    sales_person_name: string
    enabled?: number
    has_inventory?: number
    inventory_warehouse?: string
    commission_rate?: number
}

export interface Item {
    name: string
    item_code?: string
    item_name: string
    item_group?: string
    stock_uom?: string
    description?: string
    standard_rate?: number
    valuation_rate?: number
    image?: string
    has_batch_no?: number
    has_serial_no?: number
    is_stock_item?: number
    disabled?: number
    creation?: string
    modified?: string

    uoms?: UOMConversionDetail[]
    custom_barcode?: string
    custom_brand?: string
}

export interface ItemGroup {
    name: string
    is_group?: number
    parent_item_group?: string
}

export interface UOM {
    name: string
    uom_name?: string
    enabled?: number
    must_be_whole_number?: number
}

/** UOM Conversion Detail — child row of Item.uoms */
export interface UOMConversionDetail {
    uom: string
    conversion_factor: number
}

// ==================== API ====================

export const stockApi = {

    // ---- Warehouses ----
    /** Get leaf (non-group) warehouses only. Group nodes cannot be used in transactions. */
    async getWarehouses(options?: FrappeRequestOptions & { company?: string }): Promise<Warehouse[]> {
        const { company, ...rest } = options || {}
        const baseFilters: FrappeFilter[] = [
            ['Warehouse', 'is_group', '=', 0],
            ['Warehouse', 'disabled', '=', 0],
        ]
        if (company) baseFilters.push(['Warehouse', 'company', '=', company])
        return frappeClient.getList<Warehouse>('Warehouse', {
            filters: baseFilters,
            fields: [
                'name', 'warehouse_name', 'custom_warehouse_type',
                'custom_is_dynamic', 'custom_linked_sales_person', 'custom_linked_customer',
                'custom_gps_lat', 'custom_gps_lng',
                'is_group', 'company', 'parent_warehouse', 'disabled',
            ],
            order_by: 'custom_warehouse_type asc, warehouse_name asc',
            limit_page_length: 500,
            ...rest,
        })
    },

    async getVanWarehouses(company?: string): Promise<Warehouse[]> {
        const filters: FrappeFilter[] = [
            ['Warehouse', 'custom_warehouse_type', '=', 'Van'],
            ['Warehouse', 'is_group', '=', 0],
            ['Warehouse', 'disabled', '=', 0],
        ]
        if (company) filters.push(['Warehouse', 'company', '=', company])
        return frappeClient.getList<Warehouse>('Warehouse', {
            filters,
            fields: [
                'name', 'warehouse_name', 'custom_warehouse_type',
                'custom_linked_sales_person', 'custom_is_dynamic', 'disabled', 'company',
            ],
            order_by: 'warehouse_name asc',
            limit_page_length: 200,
        })
    },

    /** Create a new warehouse. */
    async createWarehouse(data: {
        warehouse_name: string
        company: string
        custom_warehouse_type?: Warehouse['custom_warehouse_type']
        custom_linked_sales_person?: string
        custom_linked_customer?: string
        custom_linked_customers?: string
        parent_warehouse?: string
        is_group?: number
        custom_gps_lat?: string
        custom_gps_lng?: string
    }): Promise<Warehouse> {
        const res = await frappeClient.post<Warehouse>('Warehouse', {
            ...data,
            is_group: data.is_group ?? 0,
        })
        if (!res.data) throw new Error('Failed to create warehouse')
        return res.data
    },

    /** Update an existing warehouse. */
    async updateWarehouse(name: string, data: Partial<Warehouse>): Promise<Warehouse> {
        const res = await frappeClient.put<Warehouse>('Warehouse', name, data)
        if (!res.data) throw new Error('Failed to update warehouse')
        return res.data
    },

    /** Toggle warehouse disabled status. */
    async toggleWarehouse(name: string, disabled: boolean): Promise<Warehouse> {
        const res = await frappeClient.put<Warehouse>('Warehouse', name, { disabled: disabled ? 1 : 0 })
        if (!res.data) throw new Error('Failed to toggle warehouse')
        return res.data
    },

    /** Delete a warehouse permanently. */
    async deleteWarehouse(name: string): Promise<void> {
        await frappeClient.delete('Warehouse', name)
    },

    // ---- Sales Persons ----
    async getSalesPersons(company?: string): Promise<SalesPerson[]> {
        const filters: FrappeFilter[] = [['Sales Person', 'enabled', '=', 1]]
        // Sales Person has NO `company` field (frappe 417s the whole query);
        // scope via the Employee link instead — see sales-api.getSalesPersons.
        if (company) {
            const employees = await frappeClient.getList<{ name: string }>('Employee', {
                filters: [['Employee', 'company', '=', company]],
                fields: ['name'],
                limit_page_length: 500,
            })
            if (!employees.length) return []
            filters.push(['Sales Person', 'employee', 'in', employees.map(e => e.name)])
        }
        return frappeClient.getList<SalesPerson>('Sales Person', {
            filters,
            fields: ['name', 'sales_person_name', 'enabled', 'has_inventory', 'inventory_warehouse', 'commission_rate'],
            order_by: 'sales_person_name asc',
            limit_page_length: 500,
        })
    },

    /** Get companies list for dropdowns. */
    async getCompanies(): Promise<Array<{ name: string; company_name: string }>> {
        return frappeClient.getList<{ name: string; company_name: string }>('Company', {
            fields: ['name', 'company_name'],
            order_by: 'name asc',
            limit_page_length: 50,
        })
    },

    /** Get warehouse groups (parents) for a company. */
    async getWarehouseGroups(company?: string): Promise<Warehouse[]> {
        const filters: FrappeFilter[] = [['Warehouse', 'is_group', '=', 1]]
        if (company) filters.push(['Warehouse', 'company', '=', company])
        return frappeClient.getList<Warehouse>('Warehouse', {
            filters,
            fields: ['name', 'warehouse_name', 'company'],
            order_by: 'warehouse_name asc',
            limit_page_length: 100,
        })
    },

    // ---- Stock Status ----
    async getStockStatuses(): Promise<StockStatus[]> {
        return frappeClient.getList<StockStatus>('Stock Status', {
            fields: ['name', 'status_name', 'status_code', 'color', 'is_sellable', 'enabled', 'description'],
            order_by: 'status_code asc',
            limit_page_length: 50,
        })
    },

    // ---- Stock Movement Audit ----
    async getAuditLogs(options?: FrappeRequestOptions): Promise<StockMovementAudit[]> {
        return frappeClient.getList<StockMovementAudit>('Stock Movement Audit', {
            fields: [
                'name', 'movement_date', 'movement_time', 'item_code', 'warehouse',
                'batch_no', 'quantity_change', 'previous_qty', 'new_qty',
                'movement_type', 'reference_doctype', 'reference_name',
                'user', 'action', 'creation',
            ],
            order_by: 'movement_date desc, movement_time desc',
            limit_page_length: 100,
            ...options,
        })
    },

    // ---- Stock Transfer Requests ----
    async getTransferRequests(options?: FrappeRequestOptions): Promise<StockTransferRequest[]> {
        return frappeClient.getList<StockTransferRequest>('Stock Transfer Request', {
            fields: [
                'name', 'request_date', 'from_warehouse', 'to_warehouse',
                'sales_person', 'status', 'total_quantity',
                'accepted_by', 'accepted_date', 'stock_entry', 'docstatus', 'creation',
            ],
            order_by: 'request_date desc',
            limit_page_length: 200,
            ...options,
        })
    },

    async getTransferRequest(name: string): Promise<StockTransferRequest | null> {
        const res = await frappeClient.get<StockTransferRequest>('Stock Transfer Request', name)
        return res.data || null
    },

    /** Update a Stock Transfer Request (e.g. change from_warehouse before accepting). */
    async updateTransferRequest(name: string, data: Partial<Pick<StockTransferRequest, 'from_warehouse' | 'to_warehouse'>>): Promise<StockTransferRequest> {
        const res = await frappeClient.put<StockTransferRequest>('Stock Transfer Request', name, data)
        if (!res.data) throw new Error('Failed to update transfer request')
        return res.data
    },

    async acceptTransferRequest(requestName: string, acceptedItems?: Array<{ item_code: string; batch_no?: string; accepted_qty: number }>): Promise<any> {
        return frappeClient.call(
            'base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.accept_transfer_request',
            {
                request_name: requestName,
                ...(acceptedItems ? { accepted_items: JSON.stringify(acceptedItems) } : {}),
            }
        )
    },

    async rejectTransferRequest(requestName: string, rejectionReason: string): Promise<any> {
        return frappeClient.call(
            'base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.reject_transfer_request',
            { request_name: requestName, rejection_reason: rejectionReason }
        )
    },

    async getPendingTransferRequests(salesPerson?: string): Promise<StockTransferRequest[]> {
        const res = await frappeClient.call(
            'base_meena.stock_management.doctype.stock_transfer_request.stock_transfer_request.get_pending_requests_for_sales_person',
            salesPerson ? { sales_person: salesPerson } : {}
        )
        return (res.message as StockTransferRequest[]) || []
    },

    // ---- Return Logs ----
    async getReturnLogs(options?: FrappeRequestOptions): Promise<ReturnLog[]> {
        return frappeClient.getList<ReturnLog>('Return Log', {
            fields: [
                'name', 'return_date', 'warehouse', 'sales_person', 'customer',
                'return_reason', 'total_quantity', 'total_value', 'status',
                'docstatus', 'creation',
            ],
            order_by: 'return_date desc',
            limit_page_length: 200,
            ...options,
        })
    },

    async getReturnLog(name: string): Promise<ReturnLog | null> {
        const res = await frappeClient.get<ReturnLog>('Return Log', name)
        return res.data || null
    },

    async getInvoiceItemsForReturn(salesInvoice: string): Promise<any[]> {
        const res = await frappeClient.call(
            'base_meena.stock_management.doctype.return_log.return_log.get_invoice_items',
            { sales_invoice: salesInvoice }
        )
        return (res.message as any[]) || []
    },

    // ---- Sales Person Stock ----
    async getSalesPersonStock(salesPerson: string): Promise<SalesPersonStockItem[]> {
        const res = await frappeClient.call(
            'base_meena.stock_management.stock_validation.get_salesperson_stock',
            { sales_person: salesPerson }
        )
        const raw = (res.message as any[]) || []
        return raw.map(item => ({
            item_code: item.item_code,
            item_name: item.item_name,
            warehouse: item.warehouse || '',
            actual_qty: item.actual_qty ?? item.qty ?? 0,
            stock_uom: item.stock_uom || item.uom || '',
            valuation_rate: item.valuation_rate ?? item.rate ?? 0,
            stock_value: item.stock_value ?? item.value ?? 0,
            has_batch_no: item.has_batch_no ?? 0,
            has_serial_no: item.has_serial_no ?? 0,
            batches: (item.batches || []).map((b: any) => ({
                batch_no: b.batch_no,
                qty: b.qty,
                expiry_date: b.expiry_date,
                stock_status: b.stock_status,
            })),
            serial_numbers: item.serial_numbers || [],
        }))
    },

    async checkItemAvailability(itemCode: string, warehouse: string, qty: number, batchNo?: string, serialNo?: string): Promise<{
        item_code: string
        warehouse: string
        requested_qty: number
        available_qty: number
        is_available: boolean
        shortage: number
        serial_validation?: { valid: boolean; errors: string[] }
    }> {
        const res = await frappeClient.call(
            'base_meena.stock_management.stock_validation.check_item_availability',
            {
                item_code: itemCode, warehouse, qty,
                ...(batchNo ? { batch_no: batchNo } : {}),
                ...(serialNo ? { serial_no: serialNo } : {}),
            }
        )
        return res.message as any
    },

    // ---- Bin (warehouse stock levels) ----
    async getBinStock(warehouse?: string): Promise<BinStock[]> {
        const filters: FrappeFilter[] = []
        if (warehouse) filters.push(['Bin', 'warehouse', '=', warehouse])

        // Fetch with all fields first, fallback to minimal if permission error
        try {
            const data = await frappeClient.getList<BinStock>('Bin', {
                filters,
                fields: ['item_code', 'warehouse', 'actual_qty', 'stock_uom', 'valuation_rate', 'stock_value'],
                order_by: 'stock_value desc',
                limit_page_length: 2000,
            })
            return data.filter(b => (b.actual_qty || 0) > 0)
        } catch {
            // Fallback: some fields may not be permitted
            const data = await frappeClient.getList<BinStock>('Bin', {
                filters,
                fields: ['item_code', 'warehouse', 'actual_qty'],
                limit_page_length: 2000,
            })
            return data.filter(b => (b.actual_qty || 0) > 0)
        }
    },

    // ---- Main-inventory management (managers only, guarded server-side) ----

    /** Create a new product (Item), optionally with opening stock in a warehouse. */
    async addProduct(payload: {
        item_name: string
        item_code?: string
        uom?: string
        standard_rate?: number
        warehouse?: string
        opening_qty?: number
        valuation_rate?: number
    }): Promise<{ item_code: string; created: boolean; stock_entry?: string }> {
        const res = await frappeClient.call(
            'base_meena.stock_management.stock_validation.add_product',
            payload
        )
        return (res.message || res.data) as any
    },

    // ---- Create documents ----

    /** Create a new Stock Transfer Request.
     *  from_warehouse → to_warehouse with a list of items.
     */
    async createTransferRequest(data: {
        from_warehouse: string
        to_warehouse: string
        sales_person?: string
        request_date?: string
        items: Array<{ item_code: string; requested_qty: number; uom?: string; batch_no?: string; serial_no?: string }>
    }): Promise<StockTransferRequest> {
        const res = await frappeClient.post<StockTransferRequest>('Stock Transfer Request', {
            request_date: data.request_date || new Date().toISOString().split('T')[0],
            from_warehouse: data.from_warehouse,
            to_warehouse: data.to_warehouse,
            ...(data.sales_person ? { sales_person: data.sales_person } : {}),
            items: data.items,
        })
        if (!res.data) throw new Error('Failed to create transfer request')
        return res.data
    },

    /** Create a new Return Log (customer goods returned to warehouse). */
    async createReturnLog(data: {
        return_date?: string
        warehouse: string
        sales_person?: string
        customer?: string
        return_reason?: string
        sales_invoice?: string
        items: Array<{ item_code: string; quantity: number; rate?: number; uom?: string; batch_no?: string; serial_no?: string }>
    }): Promise<ReturnLog> {
        const res = await frappeClient.post<ReturnLog>('Return Log', {
            return_date: data.return_date || new Date().toISOString().split('T')[0],
            warehouse: data.warehouse,
            ...(data.sales_person ? { sales_person: data.sales_person } : {}),
            ...(data.customer ? { customer: data.customer } : {}),
            ...(data.return_reason ? { return_reason: data.return_reason } : {}),
            ...(data.sales_invoice ? { sales_invoice: data.sales_invoice } : {}),
            items: data.items,
        })
        if (!res.data) throw new Error('Failed to create return log')
        return res.data
    },

    /** Submit a Return Log (creates the stock entry for returned items). */
    async submitReturnLog(name: string): Promise<ReturnLog> {
        const doc = await this.getReturnLog(name)
        if (!doc) throw new Error(`Return Log ${name} not found`)
        const res = await frappeClient.call<ReturnLog>('frappe.client.submit', {
            doc: { ...doc, doctype: 'Return Log' },
        })
        return (res.message as ReturnLog) || doc
    },

    /** Cancel a submitted Return Log (cancels the linked stock entry). */
    async cancelReturnLog(name: string): Promise<void> {
        await frappeClient.call('frappe.client.cancel', {
            doctype: 'Return Log',
            name,
        })
    },

    /** Search ERPNext Items by item code OR item name (for autocomplete inputs). */
    async searchItems(query: string, limit = 20): Promise<Array<{ name: string; item_name: string; stock_uom: string; _matchedBy?: 'code' | 'name' }>> {
        if (!query || query.length < 1) return []

        // Search by item code (name field) AND item_name in parallel
        const [byCode, byItemName] = await Promise.allSettled([
            frappeClient.getList<{ name: string; item_name: string; stock_uom: string }>('Item', {
                filters: [
                    ['Item', 'disabled', '=', 0],
                    ['Item', 'name', 'like', `%${escapeLike(query)}%`],
                ] as FrappeFilter[],
                fields: ['name', 'item_name', 'stock_uom'],
                limit_page_length: limit,
                order_by: 'name asc',
            }),
            frappeClient.getList<{ name: string; item_name: string; stock_uom: string }>('Item', {
                filters: [
                    ['Item', 'disabled', '=', 0],
                    ['Item', 'item_name', 'like', `%${escapeLike(query)}%`],
                ] as FrappeFilter[],
                fields: ['name', 'item_name', 'stock_uom'],
                limit_page_length: limit,
                order_by: 'item_name asc',
            }),
        ])

        const codeResults = byCode.status === 'fulfilled' ? byCode.value : []
        const nameResults = byItemName.status === 'fulfilled' ? byItemName.value : []

        // Merge and deduplicate — code matches first, then name matches
        const seen = new Set<string>()
        const merged: Array<{ name: string; item_name: string; stock_uom: string; _matchedBy?: 'code' | 'name' }> = []
        for (const item of codeResults) {
            if (!seen.has(item.name)) { seen.add(item.name); merged.push({ ...item, _matchedBy: 'code' }) }
        }
        for (const item of nameResults) {
            if (!seen.has(item.name)) { seen.add(item.name); merged.push({ ...item, _matchedBy: 'name' }) }
        }

        return merged.slice(0, limit)
    },

    /** Search ERPNext Customers by name or customer_name (for autocomplete inputs). */
    async searchCustomers(query: string, limit = 10): Promise<Array<{ name: string; customer_name: string; customer_group?: string }>> {
        if (!query || query.length < 1) return []
        return frappeClient.getList('Customer', {
            filters: [
                ['Customer', 'disabled', '=', 0],
                ['Customer', 'customer_name', 'like', `%${escapeLike(query)}%`],
            ] as FrappeFilter[],
            fields: ['name', 'customer_name', 'customer_group'],
            limit_page_length: limit,
            order_by: 'customer_name asc',
        })
    },

    /**
     * Create and submit a Material Receipt (استلام بضاعة) Stock Entry.
     * Routes through the role-guarded server API (inventory-manager roles
     * only) — never a direct docstatus:1 Stock Entry POST, which would skip
     * that guard. The server derives company from the warehouse; the
     * `company` field is accepted for caller compatibility but unused.
     */
    async createMaterialReceipt(data: {
        warehouse: string
        company?: string
        items: Array<{ item_code: string; qty: number; rate?: number; uom?: string; batch_no?: string; serial_no?: string }>
        remarks?: string
    }): Promise<{ stock_entry: string }> {
        const res = await frappeClient.call(
            'base_meena.stock_management.stock_validation.create_material_receipt',
            { warehouse: data.warehouse, items: JSON.stringify(data.items), remarks: data.remarks }
        )
        return (res.message || res.data) as any
    },

    // ---- Items / Products ----

    /** List all items (products). */
    async getItems(options?: FrappeRequestOptions): Promise<Item[]> {
        return frappeClient.getList<Item>('Item', {
            fields: [
                'name', 'item_name', 'item_group', 'stock_uom', 'description',
                'standard_rate', 'valuation_rate', 'image',
                'has_batch_no', 'has_serial_no', 'is_stock_item', 'disabled',
                'creation', 'modified',
            ],
            order_by: 'modified desc',
            limit_page_length: 500,
            ...options,
        })
    },

    /** Get a single item by item_code (name). */
    async getItem(itemCode: string): Promise<Item | null> {
        const res = await frappeClient.get<Item>('Item', itemCode)
        return res.data || null
    },

    /** Create a new item (product). */
    async createItem(data: {
        item_code?: string
        item_name: string
        item_group: string
        stock_uom?: string
        description?: string
        standard_rate?: number
        is_stock_item?: number
        has_batch_no?: number
        has_serial_no?: number
        image?: string
        uoms?: UOMConversionDetail[]
    }): Promise<Item> {
        // Generate a unique item_code if not provided to avoid duplicate entry errors
        const itemCode = data.item_code || `ITEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        // Build UOM conversion rows — always include stock_uom with factor 1
        const uomRows: Array<{ uom: string; conversion_factor: number }> = [
            { uom: data.stock_uom || 'Nos', conversion_factor: 1 },
            ...(data.uoms || []).filter(u => u.uom && u.uom !== (data.stock_uom || 'Nos')),
        ]
        const res = await frappeClient.post<Item>('Item', {
            item_code: itemCode,
            item_name: data.item_name,
            item_group: data.item_group,
            stock_uom: data.stock_uom || 'Nos',
            is_stock_item: data.is_stock_item ?? 1,
            uoms: uomRows,
            ...(data.description ? { description: data.description } : {}),
            ...(data.standard_rate ? { standard_rate: data.standard_rate } : {}),
            ...(data.has_batch_no !== undefined ? { has_batch_no: data.has_batch_no } : {}),
            ...(data.has_serial_no !== undefined ? { has_serial_no: data.has_serial_no } : {}),
            ...(data.image ? { image: data.image } : {}),
        })
        if (!res.data) throw new Error(res.exc || res.message as any || 'Failed to create item')
        return res.data
    },

    /** Update an existing item. */
    async updateItem(itemCode: string, data: Partial<Item>): Promise<Item> {
        const res = await frappeClient.put<Item>('Item', itemCode, data)
        if (!res.data) throw new Error(res.exc || res.message as any || 'Failed to update item')
        return res.data
    },

    /** Toggle item disabled status. */
    async toggleItem(itemCode: string, disabled: boolean): Promise<Item> {
        const res = await frappeClient.put<Item>('Item', itemCode, { disabled: disabled ? 1 : 0 })
        if (!res.data) throw new Error(res.exc || res.message as any || 'Failed to toggle item')
        return res.data
    },

    /** List Item Groups (for group dropdown). */
    async getItemGroups(): Promise<ItemGroup[]> {
        return frappeClient.getList<ItemGroup>('Item Group', {
            fields: ['name', 'is_group', 'parent_item_group'],
            order_by: 'name asc',
            limit_page_length: 200,
        })
    },

    /** List UOMs (for UOM dropdown). */
    async getUOMs(options?: { search?: string; limit?: number; offset?: number }): Promise<UOM[]> {
        const res = await frappeClient.call<{ status: string; data: UOM[]; total: number }>(
            'base_meena.product_management.uom_management.get_uom_list',
            {
                search_term: options?.search || '',
                limit_page_length: options?.limit || 200,
                limit_start: options?.offset || 0,
            },
        )
        return res.message?.data || []
    },

    /** Create a new UOM. */
    async createUOM(data: { uom_name: string; must_be_whole_number?: number }): Promise<UOM> {
        const res = await frappeClient.post<UOM>('UOM', {
            uom_name: data.uom_name,
            must_be_whole_number: data.must_be_whole_number || 0,
        })
        return res.data as UOM
    },

    /** Update an existing UOM (fields like must_be_whole_number). */
    async updateUOM(name: string, data: { must_be_whole_number?: number }): Promise<UOM> {
        const res = await frappeClient.put<UOM>('UOM', name, data)
        return res.data as UOM
    },

    /**
     * Rename a UOM. Uses custom API that calls frappe.rename_doc
     * which automatically updates all Link fields across doctypes.
     */
    async renameUOM(oldName: string, newName: string): Promise<{ old_name: string; new_name: string }> {
        const res = await frappeClient.call<{ status: string; old_name: string; new_name: string; message: string }>(
            'base_meena.product_management.uom_management.rename_uom',
            { old_name: oldName, new_name: newName },
        )
        if (res.message?.status !== 'success') {
            throw new Error(res.message?.message || 'Failed to rename UOM')
        }
        return { old_name: res.message.old_name, new_name: res.message.new_name }
    },

    /**
     * Delete a UOM (force). Uses custom API that cleans up all linked
     * Conversion Factors, Item Barcodes, etc. before deleting.
     */
    async deleteUOM(name: string): Promise<{ cleaned_count: number }> {
        const res = await frappeClient.call<{ status: string; message: string; cleaned_count: number }>(
            'base_meena.product_management.uom_management.delete_uom',
            { uom_name: name },
        )
        if (res.message?.status !== 'success') {
            throw new Error(res.message?.message || 'Failed to delete UOM')
        }
        return { cleaned_count: res.message.cleaned_count || 0 }
    },

    /** Get Stock Ledger Entries for a warehouse (all stock movements). */
    async getStockLedgerEntries(warehouse: string, limit = 100): Promise<StockLedgerEntry[]> {
        return frappeClient.getList<StockLedgerEntry>('Stock Ledger Entry', {
            filters: [['Stock Ledger Entry', 'warehouse', '=', warehouse]],
            fields: [
                'name', 'item_code', 'warehouse', 'posting_date', 'posting_time',
                'actual_qty', 'qty_after_transaction', 'valuation_rate',
                'voucher_type', 'voucher_no', 'batch_no', 'stock_uom',
            ],
            order_by: 'posting_date desc, posting_time desc',
            limit_page_length: limit,
        })
    },

    // ---- Stock Reconciliation ----

    /**
     * List past Stock Reconciliations (most recent first).
     * Returns [] gracefully if the user has no permission for this DocType.
     */
    async getStockReconciliations(limit = 50): Promise<StockReconciliation[]> {
        try {
            // NOTE: no `remarks` field exists on Stock Reconciliation — requesting
            // it made frappe 417 the whole query for every role.
            return await frappeClient.getList<StockReconciliation>('Stock Reconciliation', {
                filters: [['Stock Reconciliation', 'purpose', '=', 'Stock Reconciliation']],
                fields: ['name', 'posting_date', 'posting_time', 'company', 'docstatus', 'creation'],
                order_by: 'posting_date desc, creation desc',
                limit_page_length: limit,
            })
        } catch {
            return []
        }
    },

    /**
     * Create and submit a Stock Reconciliation.
     * items[].qty = the *actual* physical count for that item/warehouse pair.
     * Frappe automatically calculates the difference vs system qty and posts
     * the necessary accounting entries using the company's valuation method.
     */
    async createStockReconciliation(data: {
        posting_date?: string
        company?: string
        remarks?: string
        items: Array<{
            item_code: string
            warehouse: string
            qty: number
            valuation_rate?: number
        }>
    }): Promise<StockReconciliation> {
        // Derive company from warehouse if not provided (required by ERPNext)
        let company = data.company
        if (!company && data.items.length > 0) {
            try {
                const whRes = await frappeClient.get<Warehouse>('Warehouse', data.items[0].warehouse)
                company = whRes.data?.company || undefined
            } catch { /* continue — Frappe may still default */ }
        }
        if (!company) {
            // Fallback: fetch default company
            try {
                const companies = await frappeClient.getList<{ name: string }>('Company', {
                    fields: ['name'],
                    limit_page_length: 1,
                })
                if (companies.length > 0) company = companies[0].name
            } catch { /* continue without */ }
        }

        // Step 1: Create as draft (docstatus 0)
        const createRes = await frappeClient.post<StockReconciliation>('Stock Reconciliation', {
            purpose: 'Stock Reconciliation',
            posting_date: data.posting_date || new Date().toISOString().split('T')[0],
            posting_time: new Date().toTimeString().split(' ')[0],
            ...(company ? { company } : {}),
            ...(data.remarks ? { remarks: data.remarks } : {}),
            items: data.items.map(i => ({
                item_code: i.item_code,
                warehouse: i.warehouse,
                qty: i.qty,
                ...(i.valuation_rate !== undefined ? { valuation_rate: i.valuation_rate } : {}),
            })),
        } as any)

        if (!createRes.data?.name) {
            throw new Error(createRes.exc || (createRes.message as any) || 'Failed to create stock reconciliation')
        }

        // Step 2: Submit the document (docstatus 1)
        try {
            const submitRes = await frappeClient.put<StockReconciliation>(
                'Stock Reconciliation',
                createRes.data.name,
                { docstatus: 1 } as any,
            )
            return submitRes.data || createRes.data
        } catch (submitErr) {
            // If submit fails, return the draft so user can see what happened
            console.warn('[StockReconciliation] Created but submit failed:', submitErr)
            throw new Error(`Created ${createRes.data.name} but failed to submit: ${(submitErr as Error).message}`)
        }
    },
}

export interface StockLedgerEntry {
    name: string
    item_code: string
    warehouse: string
    posting_date: string
    posting_time?: string
    actual_qty: number
    qty_after_transaction: number
    valuation_rate?: number
    voucher_type: string
    voucher_no: string
    batch_no?: string
    stock_uom?: string
}

// ==================== Stock Reconciliation ====================

export interface StockReconciliationItem {
    item_code: string
    item_name?: string
    warehouse: string
    qty: number               // actual (physical count) qty
    valuation_rate?: number
    current_qty?: number      // system qty at time of submission (read from response)
    quantity_difference?: number
}

export interface StockReconciliation {
    name: string
    posting_date: string
    posting_time?: string
    company?: string
    purpose?: string
    docstatus?: number
    items?: StockReconciliationItem[]
    creation?: string
    modified?: string
    remarks?: string
}

// ==================== Permission Setup ====================

/**
 * Custom doctypes from base_meena app that Sales Manager should have access to.
 * This is needed for fresh Frappe sites where role permissions might not be set up.
 */
const BASE_MEENA_CUSTOM_DOCTYPES = [
    'Stock Transfer Request',
    'Sales Person Visit',
    'Daily Route Plan',
    'Customer Inventory Record',
    'Product Return From Customer',
    'Return Log',
    'Stock Movement Audit',
    'Stock Status',
]

/** Permission types to grant for each doctype */
const PERMISSION_TYPES = ['read', 'write', 'create', 'delete', 'submit', 'cancel', 'amend']

/**
 * Setup all required permissions for Sales Manager role on base_meena custom doctypes.
 * Calls frappe.permissions.add_permission for each doctype+ptype combination.
 * Safe to call multiple times — Frappe will skip if permission already exists.
 */
export async function setupBaseMeenaPermissions(): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

    for (const doctype of BASE_MEENA_CUSTOM_DOCTYPES) {
        try {
            // First try to add the base permission (read at permlevel 0)
            await frappeClient.call('frappe.permissions.add_permission', {
                doctype,
                role: 'Sales Manager',
                permlevel: 0,
            })

            // Then enable each permission type
            for (const ptype of PERMISSION_TYPES) {
                try {
                    await frappeClient.call('frappe.permissions.update_permission_property', {
                        doctype,
                        role: 'Sales Manager',
                        permlevel: 0,
                        ptype,
                        value: 1,
                    })
                } catch {
                    // Some doctypes don't support submit/cancel/amend — that's fine
                }
            }

            success.push(doctype)
        } catch (e) {
            // If the doctype doesn't exist on this site, skip it
            failed.push(`${doctype}: ${String(e)}`)
        }
    }

    // Also do the same for "Sales User" role
    for (const doctype of BASE_MEENA_CUSTOM_DOCTYPES) {
        try {
            await frappeClient.call('frappe.permissions.add_permission', {
                doctype,
                role: 'Sales User',
                permlevel: 0,
            })
            for (const ptype of ['read', 'write', 'create']) {
                try {
                    await frappeClient.call('frappe.permissions.update_permission_property', {
                        doctype,
                        role: 'Sales User',
                        permlevel: 0,
                        ptype,
                        value: 1,
                    })
                } catch {
                    // skip
                }
            }
        } catch {
            // skip — doctype might not exist
        }
    }

    return { success, failed }
}
