/**
 * Sales Module API Client
 * Complete integration with Frappe/ERPNext Backend for Sales Operations
 */

import { frappeClient, type FrappeRequestOptions, type FrappeFilter } from './api-client'

// ==================== Date helpers ====================
// Frappe stores dates/datetimes in the SITE's timezone (Riyadh). The old
// `new Date().toISOString()` pattern produced the UTC date, which is the
// WRONG day between midnight and ~3am local — visits/trails/filters silently
// targeted yesterday. Always derive "today" from the browser's local clock.

/** YYYY-MM-DD in the browser's local timezone */
export function localDateISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD HH:mm:ss" in the browser's local timezone (Frappe datetime format) */
export function localDateTimeISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${localDateISO(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ==================== Customer Group display labels ====================
// Customer Group docnames are DATA (the ERPNext defaults ship in English).
// Display-translate the known defaults; client-created groups (native names)
// fall back to their raw docname untouched.

/** Localized display label for a Customer Group docname (raw name fallback). */
export function customerGroupLabel(t: (key: string) => string, name?: string | null): string {
  if (!name) return ''
  const key = 'sr.custgroup.' + name.toLowerCase().replace(/ /g, '_')
  const v = t(key)
  return v === key ? name : v
}

// Lifecycle classification (backend-automated: submit of SI/DN promotes to
// Active, daily scheduler demotes inactive Actives to Dead). Rows created
// before the field existed may be null — treat as Potential.
export type CustomerClassification = 'Potential' | 'Active' | 'Dead'

export function customerClassification(c?: { customer_classification?: string | null }): CustomerClassification {
  const v = c?.customer_classification
  return v === 'Active' || v === 'Dead' ? v : 'Potential'
}

/** Localized label for a classification value. */
export function customerClassificationLabel(t: (key: string) => string, value?: string | null): string {
  const v = customerClassification({ customer_classification: value })
  return t('sr.custclass.' + v.toLowerCase())
}

/** Badge color classes: gray = Potential, green = Active, red = Dead. */
export function customerClassificationBadgeClass(value?: string | null): string {
  if (value === 'Active') return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
  if (value === 'Dead') return 'bg-red-100 text-red-700 hover:bg-red-100'
  return 'bg-gray-100 text-gray-600 hover:bg-gray-100'
}

// ==================== Types ====================

export interface Customer {
  name: string
  customer_name: string
  customer_type: 'Company' | 'Individual' | 'Partnership'
  customer_group?: string
  customer_classification?: CustomerClassification | string
  territory?: string
  disabled?: number
  tax_id?: string
  payment_terms?: string
  primary_sales_person?: string
  last_visit_date?: string
  last_visit_by?: string
  visit_frequency_days?: number
  preferred_visit_day?: string
  customer_lat?: string
  customer_lng?: string
  customer_inventory_tracked?: number
  mobile_no?: string
  creation?: string
  modified?: string
  // ZATCA E-Invoicing fields
  zatca_customer_name_in_arabic?: string
  custom_b2c?: number
  custom_buyer_id_type?: string
  custom_buyer_id?: string
}

export interface SalesOrder {
  name: string
  customer: string
  customer_name?: string
  order_type: 'Sales' | 'Maintenance' | 'Shopping Cart'
  transaction_date: string
  delivery_date?: string
  set_warehouse?: string
  items?: SalesOrderItem[]
  taxes?: any[]
  taxes_and_charges?: string
  status: string
  grand_total: number
  net_total?: number
  total_taxes_and_charges?: number
  sales_team?: any[]
  delivery_status?: string
  billing_status?: string
  total_discount_amount?: number
  discount_approved_by?: string
  docstatus?: number
  creation?: string
  modified?: string
}

export interface SalesOrderItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  amount?: number
  delivery_date?: string
  warehouse?: string
  uom?: string
}

export interface Quotation {
  name: string
  quotation_to: 'Customer' | 'Lead' | 'Prospect'
  party_name: string
  transaction_date: string
  valid_till?: string
  status: string
  items?: QuotationItem[]
  grand_total: number
  creation?: string
  modified?: string
}

export interface QuotationItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  amount?: number
}

export interface SalesInvoice {
  name: string
  customer: string
  customer_name?: string
  posting_date: string
  due_date?: string
  items?: SalesInvoiceItem[]
  grand_total: number
  outstanding_amount?: number
  status: string
  is_pos?: number
  is_return?: number
  return_against?: string
  total_discount_amount?: number
  discount_approved_by?: string
  docstatus?: number
  creation?: string
  modified?: string
  // ZATCA E-Invoicing fields
  custom_zatca_status?: string
  custom_uuid?: string
  ksa_einv_qr?: string
  custom_b2c?: number
  custom_ksa_einvoicing_xml?: string
  custom_zatca_full_response?: string
}

export interface SalesInvoiceItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  amount?: number
}

export interface SalesPerson {
  name: string
  sales_person_name: string
  enabled: number
  employee?: string
  parent_sales_person?: string
  mobile_app_user?: string
  has_inventory?: number
  inventory_warehouse?: string
  current_location_lat?: string
  current_location_lng?: string
  location_last_updated?: string
  creation?: string
  modified?: string
  // zone fields exist only after the Sales Person doctype reload on a site —
  // never request them via REST fields; use salesApi.getRepZones() instead
  zone_polygon?: string
  zone_color?: string
  zone_name?: string
}

/** Presence + last location row from get_reps_status */
export interface RepStatus {
  name: string
  sales_person_name: string
  employee?: string
  inventory_warehouse?: string
  current_location_lat?: string
  current_location_lng?: string
  location_last_updated?: string
  last_seen?: string
  online: boolean
}

/** Assigned work zone row from get_rep_zones */
export interface RepZone {
  name: string
  sales_person_name: string
  zone_polygon: string
  zone_color?: string
  zone_name?: string
}

/** GPS trail point (hrms Employee Location Log) */
export interface RepLocationPoint {
  name?: string
  log_datetime: string
  latitude: number
  longitude: number
  accuracy?: number
  address?: string
}

/** Detected dwell/stop cluster from hrms detect_stops */
export interface RepStop {
  center_lat: number
  center_lng: number
  arrival: string
  departure: string
  duration_minutes: number
  points_count: number
  customer: string | null
  customer_name: string | null
  distance_to_customer: number | null
}

export interface SalesPersonVisit {
  name: string
  sales_person: string
  customer: string
  customer_name?: string
  visit_date: string
  visit_status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
  visit_type: 'Sales Order' | 'Follow-up' | 'Stock Check' | 'Product Return' | 'No Order - Visit Only'
  scheduled_check_in_time?: string
  grace_period_minutes?: number
  check_in_time?: string
  check_out_time?: string
  visit_duration?: number
  has_order?: number
  sales_order?: string
  check_in_lat?: string
  check_in_lng?: string
  check_out_lat?: string
  check_out_lng?: string
  is_within_radius?: number
  check_in_distance_meters?: number
  notes?: string
  creation?: string
  modified?: string
}

export interface DailyRoutePlan {
  name: string
  route_date: string
  sales_person: string
  territory?: string
  notes?: string
  status: 'Draft' | 'Active' | 'Completed' | 'Cancelled'
  customers?: RoutePlanCustomer[]
  total_customers: number
  visited_customers: number
  pending_customers?: number
  docstatus?: number
  creation?: string
  modified?: string
}

export interface RoutePlanCustomer {
  customer: string
  customer_name?: string
  sequence: number
  visit_type?: 'Regular Visit' | 'Follow-up' | 'New Customer' | 'Urgent'
  priority?: 'High' | 'Medium' | 'Low'
  scheduled_time?: string
  estimated_duration_minutes?: number
  notes?: string
  visit_status?: string
  visit?: string
  visit_created?: number
}

export interface SalesRouteAnalytics {
  name: string
  sales_person: string
  date: string
  total_visits: number
  completed_visits: number
  total_distance_km?: number
  actual_distance_km?: number
  planned_distance_km?: number
  average_speed_kmh?: number
  route_efficiency_score?: number
}

export interface DiscountPermissionProfile {
  name: string
  profile_name: string
  description?: string
  is_active: number
  permission_rules?: DiscountPermissionRule[]
  /** alias used by some components */
  rules?: DiscountPermissionRule[]
  max_discount_percentage?: number
}

export interface DiscountPermissionRule {
  scope: 'Item' | 'Invoice'
  discount_type: 'Percentage' | 'Amount'
  max_discount_percent?: number
  max_discount_amount?: number
  requires_approval_above?: number
  approval_role?: string
  approval_expiry_hours?: number
  allow_cumulative?: number
}

export interface DiscountApprovalRequest {
  name: string
  sales_person: string
  customer: string
  sales_invoice?: string
  request_date: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Expired'
  discount_scope: 'Item' | 'Invoice'
  discount_type: 'Percentage' | 'Amount'
  requested_discount_percent?: number
  requested_discount_amount?: number
  /** shorthand alias used by some components */
  requested_discount?: number
  item_code?: string
  item_group?: string
  original_rate?: number
  discounted_rate?: number
  justification?: string
  /** alias for justification */
  reason?: string
  approved_by?: string
  approval_date?: string
  approval_notes?: string
  expires_at?: string
  /** Frappe creation timestamp */
  creation?: string
}

export interface SalesRepInventory {
  name: string
  sales_person: string
  warehouse?: string
  transaction_type: 'Load' | 'Unload' | 'Adjustment' | 'Transfer'
  /** the non-van leg of the movement — see lib/sales-inventory.ts contract */
  from_warehouse?: string
  to_warehouse?: string
  items?: SalesRepInventoryItem[]
  total_items?: number
  total_value?: number
  stock_entry?: string
  posting_date: string
  /** alias for posting_date used by some components */
  transaction_date?: string
  docstatus?: number
}

export interface SalesRepInventoryItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  uom?: string
  amount?: number
}

export interface CustomerInventoryRecord {
  name: string
  customer: string
  sales_person: string
  visit_date?: string
  visit?: string
  items?: CustomerInventoryItem[]
  total_items?: number
  creation?: string
}

export interface CustomerInventoryItem {
  item_code: string
  item_name?: string
  current_stock: number
  batch_no?: string
  reorder_level?: number
  needs_replenishment?: number
}

export interface ProductReturn {
  name: string
  return_date: string
  return_time?: string
  sales_person: string
  customer: string
  visit?: string
  return_reason?: 'Damaged' | 'Expired' | 'Wrong Product' | 'Quality Issue' | 'Other' | string
  items?: ProductReturnItem[]
  total_qty?: number
  total_amount?: number
  /** alias for total_amount used by some components */
  total_return_value?: number
  notes?: string
  stock_entry?: string
  processed?: number
  /** status label e.g. Draft / Submitted / Accepted / Rejected */
  return_status?: string
  sales_invoice?: string
  docstatus?: number
}

export interface ProductReturnItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  amount?: number
  batch_no?: string
}

export interface Item {
  name: string
  item_name: string
  item_group?: string
  stock_uom?: string
  standard_rate?: number
  disabled?: number
  is_sales_item?: number
  description?: string
  image?: string
}

// ---- Free Samples ----

export interface FreeSampleAllocationRep {
  sales_person: string
  sales_person_name?: string
  allocated_qty: number
  distributed_qty: number
  remaining_qty: number
}

export interface FreeSampleAllowedCustomer {
  customer: string
  customer_name?: string
}

export interface FreeSampleAllocation {
  name: string
  item_code: string
  item_name?: string
  status: 'Active' | 'Exhausted' | 'Cancelled'
  reps: FreeSampleAllocationRep[]
  allow_all_customers: number
  allowed_customers: FreeSampleAllowedCustomer[]
  max_qty_per_customer: number
  max_distributions_per_month: number
  notes?: string
  creation?: string
  modified?: string
}

/** Shape returned by get_active_allocations (flattened per-rep view) */
export interface ActiveAllocation {
  name: string
  item_code: string
  item_name?: string
  status: string
  max_qty_per_customer: number
  max_distributions_per_month: number
  allocated_qty: number
  distributed_qty: number
  remaining_qty: number
  allow_all_customers: number
  allowed_customers: FreeSampleAllowedCustomer[]
}

export interface FreeSampleDistributionItem {
  item_code: string
  item_name?: string
  qty: number
  uom?: string
}

export interface FreeSampleDistribution {
  name: string
  sales_person: string
  sales_person_name?: string
  customer: string
  customer_name?: string
  distribution_date: string
  items: FreeSampleDistributionItem[]
  total_qty: number
  gps_latitude?: number
  gps_longitude?: number
  customer_confirmed: number
  status: 'Completed' | 'Cancelled'
  notes?: string
  creation?: string
  modified?: string
}

export interface AvailableSample {
  item_code: string
  item_name: string
  stock_uom: string
  total_allocated: number
  total_distributed: number
  total_remaining: number
}

export interface PerItemCustomers {
  allow_all: boolean
  customers: FreeSampleAllowedCustomer[]
}

export interface AllowedCustomersResponse {
  allow_all: boolean
  customers: FreeSampleAllowedCustomer[]
  per_item?: Record<string, PerItemCustomers>
}

// ==================== Sales API Functions ====================

export const salesApi = {
  // ---- Customers ----
  async getCustomers(options?: FrappeRequestOptions): Promise<Customer[]> {
    return frappeClient.getList<Customer>('Customer', {
      fields: ['name', 'customer_name', 'customer_type', 'customer_group', 'customer_classification', 'territory', 'disabled', 'primary_sales_person', 'last_visit_date', 'customer_lat', 'customer_lng', 'visit_frequency_days', 'tax_id', 'customer_inventory_tracked'],
      order_by: 'customer_name asc',
      limit_page_length: 500,
      ...options,
    })
  },

  async getCustomer(name: string): Promise<Customer | null> {
    const res = await frappeClient.get<Customer>('Customer', name)
    return res.data || null
  },

  async createCustomer(data: Partial<Customer>): Promise<Customer | null> {
    const res = await frappeClient.post<Customer>('Customer', data)
    return res.data || null
  },

  async updateCustomer(name: string, data: Partial<Customer>): Promise<Customer | null> {
    const res = await frappeClient.put<Customer>('Customer', name, data)
    return res.data || null
  },

  async deleteCustomer(name: string): Promise<boolean> {
    try { await frappeClient.delete('Customer', name); return true } catch { return false }
  },

  // ---- Sales Orders ----
  async getSalesOrders(options?: FrappeRequestOptions & { company?: string }): Promise<SalesOrder[]> {
    const { company, ...rest } = options || {}
    const filters: FrappeFilter[] = []
    if (company) filters.push(['Sales Order', 'company', '=', company])
    return frappeClient.getList<SalesOrder>('Sales Order', {
      fields: ['name', 'customer', 'customer_name', 'status', 'grand_total', 'transaction_date', 'delivery_date', 'order_type', 'delivery_status', 'billing_status', 'docstatus'],
      order_by: 'transaction_date desc',
      limit_page_length: 500,
      filters,
      ...rest,
    })
  },

  async getSalesOrder(name: string): Promise<SalesOrder | null> {
    const res = await frappeClient.get<SalesOrder>('Sales Order', name)
    return res.data || null
  },

  async createSalesOrder(data: Partial<SalesOrder>): Promise<SalesOrder | null> {
    const res = await frappeClient.post<SalesOrder>('Sales Order', data)
    return res.data || null
  },

  async updateSalesOrder(name: string, data: Partial<SalesOrder>): Promise<SalesOrder | null> {
    const res = await frappeClient.put<SalesOrder>('Sales Order', name, data)
    return res.data || null
  },

  async submitSalesOrder(name: string): Promise<any> {
    // Fetch the full document first to get the current modified timestamp
    const docRes = await frappeClient.get<SalesOrder>('Sales Order', name)
    const doc = docRes.data
    if (!doc) throw new Error('Sales Order not found: ' + name)
    return frappeClient.call('frappe.client.submit', { doc: { ...doc, doctype: 'Sales Order' } })
  },

  async cancelSalesOrder(name: string): Promise<any> {
    return frappeClient.call('frappe.client.cancel', { doctype: 'Sales Order', name })
  },

  async closeSalesOrders(names: string[], status: 'Closed' | 'Re-open'): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders', {
      names: JSON.stringify(names), status,
    })
  },

  // ---- Quotations ----
  async getQuotations(options?: FrappeRequestOptions): Promise<Quotation[]> {
    return frappeClient.getList<Quotation>('Quotation', {
      fields: ['name', 'party_name', 'quotation_to', 'status', 'grand_total', 'transaction_date', 'valid_till'],
      order_by: 'transaction_date desc',
      limit_page_length: 500,
      ...options,
    })
  },

  async getQuotation(name: string): Promise<Quotation | null> {
    const res = await frappeClient.get<Quotation>('Quotation', name)
    return res.data || null
  },

  async createQuotation(data: Partial<Quotation>): Promise<Quotation | null> {
    const res = await frappeClient.post<Quotation>('Quotation', data)
    return res.data || null
  },

  async convertQuotationToSO(name: string): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.quotation.quotation.make_sales_order', { source_name: name })
  },

  // ---- Sales Invoices ----
  async getSalesInvoices(options?: FrappeRequestOptions & { company?: string }): Promise<SalesInvoice[]> {
    const { company, ...rest } = options || {}
    const filters: FrappeFilter[] = []
    if (company) filters.push(['Sales Invoice', 'company', '=', company])
    return frappeClient.getList<SalesInvoice>('Sales Invoice', {
      fields: ['name', 'customer', 'customer_name', 'status', 'grand_total', 'outstanding_amount', 'posting_date', 'due_date', 'docstatus', 'is_return', 'custom_zatca_status', 'ksa_einv_qr', 'custom_b2c'],
      order_by: 'posting_date desc',
      limit_page_length: 500,
      filters,
      ...rest,
    })
  },

  async getSalesInvoice(name: string): Promise<SalesInvoice | null> {
    const res = await frappeClient.get<SalesInvoice>('Sales Invoice', name)
    return res.data || null
  },

  async createSalesInvoice(data: Partial<SalesInvoice>): Promise<SalesInvoice | null> {
    const res = await frappeClient.post<SalesInvoice>('Sales Invoice', data)
    return res.data || null
  },

  async submitSalesInvoice(name: string): Promise<any> {
    const docRes = await frappeClient.get('Sales Invoice', name)
    const doc = docRes.data
    if (!doc) throw new Error('Sales Invoice not found: ' + name)
    return frappeClient.call('frappe.client.submit', { doc: { ...doc, doctype: 'Sales Invoice' } })
  },

  /**
   * Create a Credit Note (Sales Invoice with is_return=1).
   * This creates a financial liability to the customer for returned goods.
   * If returnAgainst is provided, it links to the original Sales Invoice.
   */
  async createCreditNote(data: {
    customer: string
    company?: string
    posting_date: string
    items: { item_code: string; item_name: string; qty: number; rate: number; warehouse?: string }[]
    return_against?: string
    sales_person?: string
    taxes_and_charges?: string
    taxes?: { charge_type: string; account_head: string; description: string; rate: number }[]
  }): Promise<{ name: string } | null> {
    if (!data.company) throw new Error('Company is required for creating credit notes')
    const company = data.company
    const doc: Record<string, any> = {
      doctype: 'Sales Invoice',
      customer: data.customer,
      company,
      posting_date: data.posting_date,
      is_return: 1,
      update_outstanding_for_self: 1,
      update_stock: 1,
      items: data.items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: item.qty * -1, // Negative qty for returns
        rate: item.rate,
        ...(item.warehouse ? { warehouse: item.warehouse } : {}),
      })),
      ...(data.return_against ? { return_against: data.return_against } : {}),
      ...(data.sales_person ? {
        sales_team: [{ sales_person: data.sales_person, allocated_percentage: 100 }],
      } : {}),
      ...(data.taxes_and_charges ? { taxes_and_charges: data.taxes_and_charges } : {}),
      ...(data.taxes ? { taxes: data.taxes } : {}),
    }

    const insertRes = await frappeClient.call('frappe.client.insert', { doc })
    return insertRes?.message || null
  },

  async createInvoiceFromSO(soName: string): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice', { source_name: soName })
  },

  // ---- Delivery Notes ----
  async getDeliveryNotes(options?: FrappeRequestOptions & { company?: string }): Promise<any[]> {
    const { company, ...rest } = options || {}
    const filters: FrappeFilter[] = []
    if (company) filters.push(['Delivery Note', 'company', '=', company])
    return frappeClient.getList('Delivery Note', {
      fields: ['name', 'customer', 'customer_name', 'posting_date', 'status', 'docstatus', 'grand_total', 'total_qty', 'set_warehouse', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 500,
      filters,
      ...rest,
    })
  },

  async getDeliveryNoteById(name: string): Promise<any> {
    const res = await frappeClient.get('Delivery Note', name)
    return res.data || null
  },

  async createDeliveryNoteFromSO(soName: string): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.sales_order.sales_order.make_delivery_note', { source_name: soName })
  },

  async saveDeliveryNote(data: Record<string, any>): Promise<any> {
    const res = await frappeClient.post('Delivery Note', data)
    return res.data || null
  },

  async submitDeliveryNote(name: string): Promise<any> {
    const docRes = await frappeClient.get('Delivery Note', name)
    const doc = docRes.data
    if (!doc) throw new Error('Delivery Note not found: ' + name)
    return frappeClient.call('frappe.client.submit', { doc: { ...doc, doctype: 'Delivery Note' } })
  },

  // ---- Payment Entries ----
  async getPaymentEntry(invoiceName: string): Promise<any> {
    return frappeClient.call('erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry', {
      dt: 'Sales Invoice', dn: invoiceName,
    })
  },

  async getOutstandingInvoices(customer: string, company: string): Promise<any> {
    return frappeClient.call('erpnext.accounts.doctype.payment_entry.payment_entry.get_outstanding_reference_documents', {
      args: { party_type: 'Customer', party: customer, company },
    })
  },

  // ---- Items ----
  async getItems(options?: FrappeRequestOptions): Promise<Item[]> {
    // Cashier/POS catalogue groups (the supermarket seed) belong to the cashier,
    // not the sales reps ("sales reps don't sell — the cashier does"). Hide them
    // from EVERY sales-person & sales-manager product list. Non-destructive: the
    // items stay in the DB and the cashier (cashierApi) still shows them. This is
    // appended to whatever filters the caller passes, so it can't be overridden.
    const CASHIER_ITEM_GROUPS = ['السوبر ماركت']
    const { filters: overrideFilters, ...rest } = options || {}
    const baseFilters: FrappeFilter[] = overrideFilters ?? [
      ['Item', 'disabled', '=', 0],
      ['Item', 'is_sales_item', '=', 1],
    ]
    return frappeClient.getList<Item>('Item', {
      fields: ['name', 'item_name', 'item_group', 'stock_uom', 'standard_rate', 'disabled', 'description', 'image'],
      filters: [...baseFilters, ['Item', 'item_group', 'not in', CASHIER_ITEM_GROUPS]],
      order_by: 'item_name asc',
      limit_page_length: 500,
      ...rest,
    })
  },

  // ---- Sales Persons ----

  /** Get employees that can be linked as sales reps (not already linked to a Sales Person) */
  async getAvailableEmployees(existingSalesPersons: SalesPerson[], company?: string): Promise<{ name: string, employee_name: string, user_id?: string, company?: string }[]> {
    const linkedEmployees = new Set(existingSalesPersons.map(sp => sp.employee).filter(Boolean))
    const filters: FrappeFilter[] = [['Employee', 'status', '=', 'Active']]
    if (company) filters.push(['Employee', 'company', '=', company])
    const employees = await frappeClient.getList<{ name: string, employee_name: string, user_id?: string, company?: string }>('Employee', {
      fields: ['name', 'employee_name', 'user_id', 'company'],
      filters,
      order_by: 'employee_name asc',
      limit_page_length: 500,
    })
    return employees.filter(emp => !linkedEmployees.has(emp.name))
  },

  async getSalesPersons(options?: FrappeRequestOptions & { company?: string }): Promise<SalesPerson[]> {
    const { company, ...rest } = options || {}
    // Leaf reps only, always: tree group nodes ("Sales Team") are not reps and
    // must never appear in counts or dropdowns. Callers' filters are merged in.
    const baseFilters: FrappeFilter[] = [['Sales Person', 'is_group', '=', 0]]
    // Sales Person has NO `company` field — requesting or filtering it makes
    // frappe reject the whole query with 417 "Field not permitted in query"
    // (route map / schedule / reports showed no reps for plain Sales users).
    // Company scoping goes through the real link: Sales Person.employee →
    // Employee.company. External reps (mobile_app_user only, no employee)
    // have no company and are excluded when a company scope is requested.
    if (company) {
      const employees = await frappeClient.getList<{ name: string }>('Employee', {
        filters: [['Employee', 'company', '=', company]],
        fields: ['name'],
        limit_page_length: 500,
      })
      if (!employees.length) return []
      baseFilters.push(['Sales Person', 'employee', 'in', employees.map(e => e.name)])
    }
    const mergedFilters = [...baseFilters, ...((rest.filters as FrappeFilter[] | undefined) || [])]
    return frappeClient.getList<SalesPerson>('Sales Person', {
      fields: ['name', 'sales_person_name', 'enabled', 'employee'],
      order_by: 'sales_person_name asc',
      limit_page_length: 500,
      ...rest,
      filters: mergedFilters,
    })
  },

  async getSalesPerson(name: string): Promise<SalesPerson | null> {
    const res = await frappeClient.get<SalesPerson>('Sales Person', name)
    return res.data || null
  },

  async createSalesPerson(data: Partial<SalesPerson>): Promise<SalesPerson | null> {
    const res = await frappeClient.post<SalesPerson>('Sales Person', data)
    return res.data || null
  },

  /**
   * Create a Frappe User account for an external sales rep, then create the Sales Person.
   * Steps: 1) Create User with email/password + Employee & Sales User roles  2) Create Sales Person with mobile_app_user = email
   */
  async createSalesRepWithUser(opts: {
    email: string
    full_name: string
    password: string
    salesPersonData: Partial<SalesPerson>
  }): Promise<{ user: boolean; salesPerson: SalesPerson | null }> {
    // Step 1: Create the Frappe user with Employee + Sales User roles
    const userResult = await frappeClient.createUser(
      opts.email,
      opts.full_name,
      opts.password,
      ['Employee', 'Sales User']
    )
    if (!userResult.success) {
      throw new Error(`Failed to create user account for ${opts.email}. The email may already exist.`)
    }

    // Step 2: Create Sales Person linked to the new user
    const spData: Partial<SalesPerson> = {
      ...opts.salesPersonData,
      mobile_app_user: opts.email,
    }
    const res = await frappeClient.post<SalesPerson>('Sales Person', spData)
    return { user: true, salesPerson: res.data || null }
  },

  async updateSalesPerson(name: string, data: Partial<SalesPerson>): Promise<SalesPerson | null> {
    // Use custom whitelisted method that saves with ignore_links=True
    // to avoid LinkValidationError when parent_sales_person references a missing node.
    const res = await frappeClient.call<SalesPerson>(
      'base_meena.stock_management.warehouse_management.update_sales_person',
      { name, data }
    )
    return res.message || res.data || null
  },

  async deleteSalesPerson(name: string): Promise<boolean> {
    try {
      await frappeClient.call(
        'base_meena.stock_management.warehouse_management.delete_sales_person',
        { name }
      )
      return true
    } catch { return false }
  },

  async getSalesPersonDashboard(salesPerson: string): Promise<any> {
    const res = await frappeClient.call('erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_dashboard_stats', { sales_person: salesPerson })
    return res.message || res.data
  },

  async getNearbyCustomers(salesPerson: string, lat: number, lng: number, radiusKm: number = 5): Promise<any> {
    const res = await frappeClient.call('erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_nearby_customers', {
      sales_person: salesPerson, latitude: lat, longitude: lng, radius_km: radiusKm,
    })
    return res.message || res.data
  },

  // ---- Presence / live tracking / zones ----

  /** Presence + last location for all enabled reps (managers only). */
  async getRepsStatus(): Promise<RepStatus[]> {
    const res = await frappeClient.call<RepStatus[]>(
      'erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_reps_status'
    )
    return (res.message || res.data || []) as RepStatus[]
  },

  /** Lightweight "I'm alive" ping from the rep PWA (works without GPS). */
  async repHeartbeat(salesPerson: string): Promise<void> {
    await frappeClient.call(
      'erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.rep_heartbeat',
      { sales_person: salesPerson }
    )
  },

  /** Assigned work zones for all reps ([] when the site lacks the fields). */
  async getRepZones(): Promise<RepZone[]> {
    const res = await frappeClient.call<RepZone[]>(
      'erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_rep_zones'
    )
    return (res.message || res.data || []) as RepZone[]
  },

  /** Assign (polygon set) or clear (polygon null) a rep's work zone. Managers only. */
  async setRepZone(salesPerson: string, zone: { polygon: string | null; color?: string; name?: string }): Promise<void> {
    await frappeClient.call(
      'erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.set_rep_zone',
      {
        sales_person: salesPerson,
        zone_polygon: zone.polygon,
        zone_color: zone.color,
        zone_name: zone.name,
      }
    )
  },

  /** GPS trail for one rep's employee on a date (hrms Employee Location Log). */
  async getRepLocations(employee: string, date: string): Promise<RepLocationPoint[]> {
    const res = await frappeClient.call<RepLocationPoint[]>(
      'hrms.hr.doctype.employee_location_log.location_api.get_employee_locations',
      { employee, date }
    )
    return (res.message || res.data || []) as RepLocationPoint[]
  },

  /** Detected dwell locations (stops) for one rep's employee on a date. */
  async detectRepStops(
    employee: string,
    opts: { date: string; radius_meters?: number; min_duration_minutes?: number }
  ): Promise<RepStop[]> {
    const res = await frappeClient.call<RepStop[]>(
      'hrms.hr.doctype.employee_location_log.location_api.detect_stops',
      { employee, ...opts }
    )
    return (res.message || res.data || []) as RepStop[]
  },

  // ---- Sales Person Visits ----
  async getVisits(options?: FrappeRequestOptions): Promise<SalesPersonVisit[]> {
    return frappeClient.getList<SalesPersonVisit>('Sales Person Visit', {
      fields: ['name', 'sales_person', 'customer', 'visit_date', 'visit_status', 'visit_type', 'scheduled_check_in_time', 'grace_period_minutes', 'check_in_time', 'check_out_time', 'visit_duration', 'has_order', 'sales_order', 'is_within_radius'],
      order_by: 'visit_date desc, check_in_time desc',
      limit_page_length: 500,
      ...options,
    })
  },

  async getVisit(name: string): Promise<SalesPersonVisit | null> {
    const res = await frappeClient.get<SalesPersonVisit>('Sales Person Visit', name)
    return res.data || null
  },

  async createVisit(data: Partial<SalesPersonVisit>): Promise<SalesPersonVisit | null> {
    const res = await frappeClient.post<SalesPersonVisit>('Sales Person Visit', data)
    return res.data || null
  },

  async updateVisit(name: string, data: Partial<SalesPersonVisit>): Promise<SalesPersonVisit | null> {
    const res = await frappeClient.put<SalesPersonVisit>('Sales Person Visit', name, data)
    return res.data || null
  },

  async deleteVisit(name: string): Promise<void> {
    await frappeClient.call(
      'erpnext.selling.doctype.sales_person_visit.sales_person_visit.delete_visit',
      { visit_name: name }
    )
  },

  async checkIn(docname: string, lat: number, lng: number): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.sales_person_visit.sales_person_visit.check_in', {
      docname, latitude: lat, longitude: lng,
    })
  },

  async checkOut(docname: string, lat: number, lng: number): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.sales_person_visit.sales_person_visit.check_out', {
      docname, latitude: lat, longitude: lng,
    })
  },

  // ---- Daily Route Plans ----
  async getRoutePlans(options?: FrappeRequestOptions): Promise<DailyRoutePlan[]> {
    return frappeClient.getList<DailyRoutePlan>('Daily Route Plan', {
      fields: ['name', 'route_date', 'sales_person', 'status', 'territory', 'total_customers', 'visited_customers', 'pending_customers', 'docstatus'],
      order_by: 'route_date desc',
      limit_page_length: 500,
      ...options,
    })
  },

  async getRoutePlan(name: string): Promise<DailyRoutePlan | null> {
    const res = await frappeClient.get<DailyRoutePlan>('Daily Route Plan', name)
    return res.data || null
  },

  async createRoutePlan(data: Partial<DailyRoutePlan>): Promise<DailyRoutePlan | null> {
    const res = await frappeClient.post<DailyRoutePlan>('Daily Route Plan', data)
    return res.data || null
  },

  async submitRoutePlan(name: string): Promise<any> {
    // Re-fetch the latest doc to get the current `modified` timestamp
    // (hooks like on_insert may update the doc after create, causing a TimestampMismatchError)
    const latest = await frappeClient.get<DailyRoutePlan>('Daily Route Plan', name)
    const doc = latest.data
    if (!doc) throw new Error('Plan not found after create')
    return frappeClient.call('frappe.client.submit', { doc: { ...doc, doctype: 'Daily Route Plan' } })
  },

  async updateRoutePlan(name: string, data: Partial<DailyRoutePlan>): Promise<DailyRoutePlan | null> {
    const res = await frappeClient.put<DailyRoutePlan>('Daily Route Plan', name, data)
    return res.data || null
  },

  async cancelRoutePlan(name: string): Promise<any> {
    return frappeClient.call('frappe.client.cancel', { doctype: 'Daily Route Plan', name })
  },

  async deleteRoutePlan(name: string): Promise<void> {
    await frappeClient.delete('Daily Route Plan', name)
  },

  async getSuggestedCustomers(salesPerson: string, routeDate: string, territory?: string): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.daily_route_plan.daily_route_plan.get_suggested_customers', {
      sales_person: salesPerson, route_date: routeDate, territory: territory || '', include_due: true,
    })
  },

  // ---- Route Map ----
  async getRouteData(salesPerson: string, date: string, lat?: number, lng?: number): Promise<any> {
    return frappeClient.call('erpnext.selling.page.sales_route_map.sales_route_map.get_route_data', {
      sales_person: salesPerson, date, current_lat: lat || 0, current_lng: lng || 0,
    })
  },

  // ---- Route Analytics ----
  async getRouteAnalytics(options?: FrappeRequestOptions): Promise<SalesRouteAnalytics[]> {
    return frappeClient.getList<SalesRouteAnalytics>('Sales Route Analytics', {
      fields: ['name', 'sales_person', 'date', 'total_visits', 'completed_visits', 'route_efficiency_score', 'total_distance_km', 'average_speed_kmh'],
      order_by: 'date desc',
      limit_page_length: 500,
      ...options,
    })
  },

  async createDailyAnalytics(): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.sales_route_analytics.sales_route_analytics.create_daily_route_analytics')
  },

  // ---- Discount Permission Profiles ----
  async getDiscountProfiles(options?: FrappeRequestOptions): Promise<DiscountPermissionProfile[]> {
    return frappeClient.getList<DiscountPermissionProfile>('Discount Permission Profile', {
      fields: ['name', 'profile_name', 'is_active', 'description'],
      order_by: 'profile_name asc',
      limit_page_length: 200,
      ...options,
    })
  },

  async getDiscountProfile(name: string): Promise<DiscountPermissionProfile | null> {
    const res = await frappeClient.get<DiscountPermissionProfile>('Discount Permission Profile', name)
    return res.data || null
  },

  async createDiscountProfile(data: Partial<DiscountPermissionProfile>): Promise<DiscountPermissionProfile | null> {
    const res = await frappeClient.post<DiscountPermissionProfile>('Discount Permission Profile', data)
    return res.data || null
  },

  async updateDiscountProfile(name: string, data: Partial<DiscountPermissionProfile>): Promise<DiscountPermissionProfile | null> {
    const res = await frappeClient.put<DiscountPermissionProfile>('Discount Permission Profile', name, data)
    return res.data || null
  },

  // ---- Discount Approval Requests ----
  async getDiscountApprovals(options?: FrappeRequestOptions): Promise<DiscountApprovalRequest[]> {
    return frappeClient.getList<DiscountApprovalRequest>('Discount Approval Request', {
      fields: ['name', 'sales_person', 'customer', 'status', 'discount_type', 'discount_scope', 'requested_discount_percent', 'requested_discount_amount', 'request_date', 'expires_at', 'justification', 'item_code'],
      order_by: 'request_date desc',
      limit_page_length: 500,
      ...options,
    })
  },

  async getPendingApprovals(): Promise<any> {
    const res = await frappeClient.call('erpnext.selling.doctype.discount_approval_request.discount_approval_request.get_pending_approvals')
    return res.message || res.data || []
  },

  async approveDiscount(requestName: string, notes: string): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.discount_approval_request.discount_approval_request.approve_request', {
      request_name: requestName, notes,
    })
  },

  async rejectDiscount(requestName: string, notes: string): Promise<any> {
    return frappeClient.call('erpnext.selling.doctype.discount_approval_request.discount_approval_request.reject_request', {
      request_name: requestName, notes,
    })
  },

  // ---- Sales Rep Inventory ----
  async getSalesRepInventory(options?: FrappeRequestOptions): Promise<SalesRepInventory[]> {
    return frappeClient.getList<SalesRepInventory>('Sales Rep Inventory', {
      fields: ['name', 'sales_person', 'transaction_type', 'posting_date', 'stock_entry', 'warehouse', 'docstatus', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 500,
      ...options,
    })
  },

  async getSalesRepInventoryById(name: string): Promise<SalesRepInventory | null> {
    const res = await frappeClient.get<SalesRepInventory>('Sales Rep Inventory', name)
    return res.data || null
  },

  async createSalesRepInventory(data: Partial<SalesRepInventory>): Promise<SalesRepInventory | null> {
    const res = await frappeClient.post<SalesRepInventory>('Sales Rep Inventory', data)
    return res.data || null
  },

  async updateSalesRepInventory(name: string, data: Partial<SalesRepInventory>): Promise<SalesRepInventory | null> {
    const res = await frappeClient.put<SalesRepInventory>('Sales Rep Inventory', name, data)
    return res.data || null
  },

  async deleteSalesRepInventory(name: string): Promise<boolean> {
    await frappeClient.delete('Sales Rep Inventory', name)
    return true
  },

  async submitSalesRepInventory(name: string): Promise<any> {
    // Must re-fetch the latest doc to get the correct `modified` timestamp,
    // otherwise Frappe throws TimestampMismatchError
    const docRes = await frappeClient.get('Sales Rep Inventory', name)
    const doc = docRes.data
    if (!doc) throw new Error('Sales Rep Inventory not found: ' + name)
    return frappeClient.call('frappe.client.submit', { doc: { ...doc, doctype: 'Sales Rep Inventory' } })
  },

  // ---- Customer Inventory Records ----
  async getCustomerInventory(options?: FrappeRequestOptions): Promise<CustomerInventoryRecord[]> {
    // Try with visit_date first; fall back to minimal fields if it doesn't exist on the doctype
    try {
      return await frappeClient.getList<CustomerInventoryRecord>('Customer Inventory Record', {
        fields: ['name', 'customer', 'sales_person', 'visit_date', 'creation'],
        order_by: 'creation desc',
        limit_page_length: 500,
        ...options,
      })
    } catch {
      return frappeClient.getList<CustomerInventoryRecord>('Customer Inventory Record', {
        fields: ['name', 'customer', 'sales_person', 'creation'],
        order_by: 'creation desc',
        limit_page_length: 500,
        ...options,
      })
    }
  },

  async createCustomerInventory(data: Partial<CustomerInventoryRecord>): Promise<CustomerInventoryRecord | null> {
    const res = await frappeClient.post<CustomerInventoryRecord>('Customer Inventory Record', data)
    return res.data || null
  },

  async getCustomerInventoryById(name: string): Promise<CustomerInventoryRecord | null> {
    const res = await frappeClient.get<CustomerInventoryRecord>('Customer Inventory Record', name)
    return res.data || null
  },

  // ---- Customer Credit Balance ----

  /**
   * Get a customer's outstanding credit notes (is_return=1, outstanding < 0).
   * Returns credit notes that still have an unreconciled balance.
   */
  async getCustomerCreditNotes(customer: string): Promise<SalesInvoice[]> {
    return frappeClient.getList<SalesInvoice>('Sales Invoice', {
      filters: [
        ['Sales Invoice', 'customer', '=', customer],
        ['Sales Invoice', 'is_return', '=', 1],
        ['Sales Invoice', 'docstatus', '=', 1],
        ['Sales Invoice', 'outstanding_amount', '<', 0],
      ],
      fields: ['name', 'customer', 'customer_name', 'posting_date', 'grand_total', 'outstanding_amount', 'status', 'is_return', 'return_against', 'docstatus'],
      order_by: 'posting_date desc',
      limit_page_length: 100,
    })
  },

  /**
   * Get total outstanding credit balance for a customer (sum of negative outstanding from credit notes).
   * Returns a positive number representing how much the customer is owed.
   */
  async getCustomerCreditBalance(customer: string): Promise<number> {
    const creditNotes = await this.getCustomerCreditNotes(customer)
    return creditNotes.reduce((sum, cn) => sum + Math.abs(cn.outstanding_amount || 0), 0)
  },

  /**
   * Get outstanding credit balances grouped by customer.
   * Returns array of { customer, customer_name, credit_balance, credit_notes_count }.
   */
  async getAllCustomerCreditBalances(): Promise<{ customer: string; customer_name: string; credit_balance: number; credit_notes_count: number }[]> {
    const allCreditNotes = await frappeClient.getList<SalesInvoice>('Sales Invoice', {
      filters: [
        ['Sales Invoice', 'is_return', '=', 1],
        ['Sales Invoice', 'docstatus', '=', 1],
        ['Sales Invoice', 'outstanding_amount', '<', 0],
      ],
      fields: ['name', 'customer', 'customer_name', 'outstanding_amount'],
      limit_page_length: 5000,
    })

    const grouped = new Map<string, { customer_name: string; total: number; count: number }>()
    for (const cn of allCreditNotes) {
      const existing = grouped.get(cn.customer) || { customer_name: cn.customer_name || cn.customer, total: 0, count: 0 }
      existing.total += Math.abs(cn.outstanding_amount || 0)
      existing.count += 1
      grouped.set(cn.customer, existing)
    }

    return Array.from(grouped.entries()).map(([customer, data]) => ({
      customer,
      customer_name: data.customer_name,
      credit_balance: data.total,
      credit_notes_count: data.count,
    })).sort((a, b) => b.credit_balance - a.credit_balance)
  },

  /**
   * Create a refund Payment Entry (type=Pay) to return money to a customer.
   * This settles the customer's credit note balance.
   */
  async createRefundPayment(data: {
    customer: string
    amount: number
    mode_of_payment?: string
    reference_no?: string
    reference_date?: string
    posting_date?: string
    company?: string
    credit_note?: string // optional: link to specific credit note
  }): Promise<{ name: string; submitted: boolean }> {
    if (!data.company) throw new Error('Company is required for creating refund payments')
    const company = data.company

    // If linked to a specific credit note, use get_payment_entry for proper allocation
    if (data.credit_note) {
      const peDataRes = await frappeClient.call(
        'erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry',
        { dt: 'Sales Invoice', dn: data.credit_note, payment_type: 'Pay' }
      )
      const pe = peDataRes?.message
      if (!pe) throw new Error('Failed to fetch refund payment data')

      // Re-fetch latest outstanding to avoid stale data
      let latestOutstanding = data.amount
      try {
        const freshInv = await frappeClient.get<SalesInvoice>('Sales Invoice', data.credit_note!)
        latestOutstanding = Math.abs(freshInv?.data?.outstanding_amount || 0)
      } catch { /* use requested amount as fallback */ }

      const safeAmount = Math.min(data.amount, latestOutstanding)
      pe.paid_amount = safeAmount
      pe.received_amount = safeAmount
      if (data.mode_of_payment) pe.mode_of_payment = data.mode_of_payment
      if (data.reference_no) {
        pe.reference_no = data.reference_no
        pe.reference_date = data.reference_date || new Date().toISOString().split('T')[0]
      }
      pe.posting_date = data.posting_date || new Date().toISOString().split('T')[0]

      if (pe.references?.length > 0) {
        let remaining = safeAmount
        pe.references = pe.references.map((ref: any) => {
          const refOutstanding = ref.outstanding_amount || 0
          const absOutstanding = Math.abs(refOutstanding)
          const allocate = Math.min(remaining, absOutstanding)
          remaining -= allocate
          // Preserve the sign of outstanding — credit notes have negative outstanding
          return { ...ref, allocated_amount: refOutstanding < 0 ? -allocate : allocate }
        }).filter((ref: any) => ref.allocated_amount !== 0)
      }

      delete pe.name
      pe.doctype = 'Payment Entry'

      // Try to insert; if allocation error, retry without references
      let insertRes: any
      try {
        insertRes = await frappeClient.call('frappe.client.insert', { doc: pe })
      } catch (insertErr: any) {
        if (String(insertErr).includes('Allocated Amount') || String(insertErr).includes('outstanding')) {
          pe.references = []
          insertRes = await frappeClient.call('frappe.client.insert', { doc: pe })
        } else {
          throw insertErr
        }
      }
      const peName = insertRes?.message?.name
      if (!peName) throw new Error('Failed to create refund payment')

      // Try to submit
      let submitted = false
      try {
        const freshDoc = await frappeClient.get<any>('Payment Entry', peName)
        if (freshDoc?.data) {
          await frappeClient.call('frappe.client.submit', { doc: { ...freshDoc.data, doctype: 'Payment Entry' } })
          submitted = true
        }
      } catch { /* draft is fine */ }

      return { name: peName, submitted }
    }

    // Generic refund (no specific credit note)
    let bankAcct: any = null
    try {
      const res = await frappeClient.call(
        'erpnext.accounts.doctype.payment_entry.payment_entry.get_default_bank_cash_account',
        { company, mode_of_payment: data.mode_of_payment || undefined }
      )
      bankAcct = res?.message
    } catch { /* ignore */ }
    if (!bankAcct?.account) {
      try {
        const res = await frappeClient.call(
          'erpnext.accounts.doctype.payment_entry.payment_entry.get_default_bank_cash_account',
          { company }
        )
        bankAcct = res?.message
      } catch { /* ignore */ }
    }
    if (!bankAcct?.account) throw new Error('No bank/cash account found for refund')

    let payableAccount = ''
    try {
      const companyDoc = await frappeClient.get<any>('Company', company)
      payableAccount = companyDoc?.data?.default_receivable_account || ''
    } catch { /* ignore */ }

    const peDoc: Record<string, any> = {
      doctype: 'Payment Entry',
      payment_type: 'Pay',
      posting_date: data.posting_date || new Date().toISOString().split('T')[0],
      company,
      party_type: 'Customer',
      party: data.customer,
      paid_amount: data.amount,
      received_amount: data.amount,
      target_exchange_rate: 1,
      source_exchange_rate: 1,
      paid_from: bankAcct.account,
      paid_from_account_currency: bankAcct.account_currency || 'SAR',
      ...(payableAccount ? { paid_to: payableAccount, paid_to_account_currency: 'SAR' } : {}),
      ...(data.mode_of_payment ? { mode_of_payment: data.mode_of_payment } : {}),
      ...(data.reference_no ? { reference_no: data.reference_no, reference_date: data.reference_date || new Date().toISOString().split('T')[0] } : {}),
    }

    const insertRes = await frappeClient.call('frappe.client.insert', { doc: peDoc })
    const peName = insertRes?.message?.name
    if (!peName) throw new Error('Failed to create refund payment')

    let submitted = false
    try {
      const freshDoc = await frappeClient.get<any>('Payment Entry', peName)
      if (freshDoc?.data) {
        await frappeClient.call('frappe.client.submit', { doc: { ...freshDoc.data, doctype: 'Payment Entry' } })
        submitted = true
      }
    } catch { /* draft is fine */ }

    return { name: peName, submitted }
  },

  // ---- Product Returns ----
  async getProductReturns(options?: FrappeRequestOptions): Promise<ProductReturn[]> {
    // Strategy 1: Direct REST API
    try {
      const result = await frappeClient.getList<ProductReturn>('Product Return From Customer', {
        fields: ['name', 'customer', 'sales_person', 'return_date', 'total_qty', 'notes', 'docstatus', 'creation'],
        order_by: 'creation desc',
        limit_page_length: 500,
        ...options,
      })
      console.log('[Returns] Fetched Product Return From Customer:', result.length)
      return result
    } catch (err1) {
      console.warn('[Returns] REST API failed, trying frappe.client.get_list:', err1)
    }

    // Strategy 2: frappe.client.get_list (different permission handling)
    try {
      const res = await frappeClient.call('frappe.client.get_list', {
        doctype: 'Product Return From Customer',
        fields: ['name', 'customer', 'sales_person', 'return_date', 'total_qty', 'notes', 'docstatus', 'creation'],
        order_by: 'creation desc',
        limit_page_length: 500,
      })
      const data = res.message || res.data || []
      console.log('[Returns] frappe.client.get_list result:', data.length)
      return data
    } catch (err2) {
      console.warn('[Returns] frappe.client.get_list failed, trying Credit Notes:', err2)
    }

    // Strategy 3: Fallback to Credit Notes (Sales Invoice with is_return=1)
    // These are standard ERPNext docs that always exist
    try {
      const creditNotes = await frappeClient.getList<any>('Sales Invoice', {
        filters: [['Sales Invoice', 'is_return', '=', 1]],
        fields: ['name', 'customer', 'posting_date', 'total_qty', 'grand_total', 'docstatus', 'creation', 'return_against'],
        order_by: 'creation desc',
        limit_page_length: 500,
      })
      console.log('[Returns] Credit Notes fallback:', creditNotes.length)
      // Map Credit Notes to ProductReturn interface
      return creditNotes.map((cn: any) => ({
        name: cn.name,
        customer: cn.customer,
        sales_person: '',
        return_date: cn.posting_date,
        return_reason: 'Other' as const,
        total_qty: Math.abs(cn.total_qty || 0),
        total_amount: Math.abs(cn.grand_total || 0),
        total_return_value: Math.abs(cn.grand_total || 0),
        return_status: cn.docstatus === 1 ? 'Submitted' : cn.docstatus === 2 ? 'Cancelled' : 'Draft',
        docstatus: cn.docstatus,
        sales_invoice: cn.return_against,
      }))
    } catch (err3) {
      console.warn('[Returns] Credit Notes fallback also failed:', err3)
      return []
    }
  },

  async getProductReturn(name: string): Promise<ProductReturn | null> {
    try {
      const res = await frappeClient.get<ProductReturn>('Product Return From Customer', name)
      return res.data || null
    } catch {
      try {
        const res = await frappeClient.call('frappe.client.get', {
          doctype: 'Product Return From Customer', name,
        })
        return res.message || res.data || null
      } catch { return null }
    }
  },

  async createProductReturn(data: Partial<ProductReturn>): Promise<ProductReturn | null> {
    try {
      const res = await frappeClient.post<ProductReturn>('Product Return From Customer', data)
      return res.data || null
    } catch {
      const res = await frappeClient.call('frappe.client.insert', {
        doc: { doctype: 'Product Return From Customer', ...data },
      })
      return res.message || res.data || null
    }
  },

  async submitProductReturn(name: string): Promise<any> {
    let doc: any
    try {
      const docRes = await frappeClient.get('Product Return From Customer', name)
      doc = docRes.data
    } catch {
      const docRes = await frappeClient.call('frappe.client.get', {
        doctype: 'Product Return From Customer', name,
      })
      doc = docRes.message || docRes.data
    }
    if (!doc) throw new Error('Product Return not found: ' + name)
    return frappeClient.call('frappe.client.submit', { doc: { ...doc, doctype: 'Product Return From Customer' } })
  },

  // ---- Reports ----
  async runReport(reportName: string, filters: Record<string, any>): Promise<any> {
    const res = await frappeClient.call('frappe.desk.query_report.run', {
      report_name: reportName, filters,
    })
    return res.message || res.data
  },

  // ---- Utilities ----
  async getCount(doctype: string, filters?: FrappeFilter[]): Promise<number> {
    try {
      const filterStr = filters ? JSON.stringify(filters) : '[]'
      const res = await frappeClient.call('frappe.client.get_count', { doctype, filters: filterStr })
      return (res.message as any) || 0
    } catch { return 0 }
  },

  async getTerritories(): Promise<string[]> {
    const list = await frappeClient.getList<{ name: string }>('Territory', {
      fields: ['name'], order_by: 'name asc', limit_page_length: 200,
    })
    return list.map(t => t.name)
  },

  async getCustomerGroups(): Promise<string[]> {
    // leaf groups only — the tree root ("All Customer Groups") is not a
    // valid assignment target and used to leak into the dropdowns
    const list = await frappeClient.getList<{ name: string }>('Customer Group', {
      filters: [['Customer Group', 'is_group', '=', 0]],
      fields: ['name'], order_by: 'name asc', limit_page_length: 200,
    })
    return list.map(g => g.name)
  },

  // ---- Customer Group management (guarded server-side, managers only) ----

  async createCustomerGroup(groupName: string): Promise<{ name: string }> {
    const res = await frappeClient.call(
      'base_meena.stock_management.warehouse_management.create_customer_group',
      { group_name: groupName }
    )
    return (res.message || res.data) as any
  },

  async renameCustomerGroup(oldName: string, newName: string): Promise<{ name: string }> {
    const res = await frappeClient.call(
      'base_meena.stock_management.warehouse_management.rename_customer_group',
      { old_name: oldName, new_name: newName }
    )
    return (res.message || res.data) as any
  },

  async deleteCustomerGroup(name: string): Promise<void> {
    await frappeClient.call(
      'base_meena.stock_management.warehouse_management.delete_customer_group',
      { name }
    )
  },

  /** Customer count per group (client-side aggregate; tenant scale is small) */
  async getCustomerGroupCounts(): Promise<Record<string, number>> {
    const rows = await frappeClient.getList<{ customer_group?: string }>('Customer', {
      fields: ['customer_group'], limit_page_length: 2000,
    })
    const counts: Record<string, number> = {}
    rows.forEach(r => {
      if (r.customer_group) counts[r.customer_group] = (counts[r.customer_group] || 0) + 1
    })
    return counts
  },

  async getWarehouses(company?: string): Promise<string[]> {
    const filters: FrappeFilter[] = [['Warehouse', 'is_group', '=', 0], ['Warehouse', 'disabled', '=', 0]]
    if (company) filters.push(['Warehouse', 'company', '=', company])
    const list = await frappeClient.getList<{ name: string }>('Warehouse', {
      filters,
      fields: ['name'], order_by: 'name asc', limit_page_length: 200,
    })
    return list.map(w => w.name)
  },

  /** Warehouses that are rep vans (custom_warehouse_type = 'Van'), disabled ones included. */
  async getVanWarehouses(): Promise<string[]> {
    try {
      const list = await frappeClient.getList<{ name: string }>('Warehouse', {
        filters: [['Warehouse', 'custom_warehouse_type', '=', 'Van']],
        fields: ['name'], limit_page_length: 200,
      })
      return list.map(w => w.name)
    } catch {
      return [] // custom field may not exist on non-sales tenants
    }
  },

  async getUOMs(): Promise<string[]> {
    const list = await frappeClient.getList<{ name: string }>('UOM', {
      fields: ['name'], order_by: 'name asc', limit_page_length: 200,
    })
    return list.map(u => u.name)
  },

  /** Get stock balance for items in a specific warehouse (Bin doctype) */
  async getStockBalance(warehouse: string, itemCodes: string[]): Promise<Record<string, number>> {
    if (!warehouse || itemCodes.length === 0) return {}
    const bins = await frappeClient.getList<{ item_code: string; actual_qty: number }>('Bin', {
      fields: ['item_code', 'actual_qty'],
      filters: [['Bin', 'warehouse', '=', warehouse], ['Bin', 'item_code', 'in', itemCodes]] as any,
      limit_page_length: 5000,
    })
    const result: Record<string, number> = {}
    bins.forEach(b => { result[b.item_code] = b.actual_qty })
    return result
  },

  /** Get valid UOMs for a specific item (from the Item's uoms child table) */
  async getItemUOMs(itemCode: string): Promise<string[]> {
    // Direct child-table queries (UOM Conversion Detail) are rejected with 403
    // for every role on the REST API; the parent Item document (which any
    // sales/stock user may read) carries the same rows.
    const res = await frappeClient.get<{ uoms?: { uom: string }[] }>('Item', itemCode)
    return (res.data?.uoms || []).map(u => u.uom)
  },

  // ---- Free Samples ----

  /** Get active allocations for a sales person (flattened per-rep view) */
  async getActiveAllocations(salesPerson: string): Promise<ActiveAllocation[]> {
    const res = await frappeClient.call<ActiveAllocation[]>(
      'base_meena.stock_management.doctype.free_sample_allocation.free_sample_allocation.get_active_allocations',
      { sales_person: salesPerson }
    )
    return res?.message || []
  },

  /** Get aggregated available samples (remaining qty per item) for a sales person */
  async getAvailableSamples(salesPerson: string): Promise<AvailableSample[]> {
    const res = await frappeClient.call<AvailableSample[]>(
      'base_meena.stock_management.doctype.free_sample_allocation.free_sample_allocation.get_available_samples',
      { sales_person: salesPerson }
    )
    return res?.message || []
  },

  /** Get allowed customers for a sales person */
  async getAllowedCustomers(salesPerson: string): Promise<AllowedCustomersResponse> {
    const res = await frappeClient.call<AllowedCustomersResponse>(
      'base_meena.stock_management.doctype.free_sample_allocation.free_sample_allocation.get_allowed_customers',
      { sales_person: salesPerson }
    )
    return res?.message || { allow_all: false, customers: [] }
  },

  /** Distribute free samples to a customer */
  async distributeSamples(params: {
    salesPerson: string
    customer: string
    items: { item_code: string; qty: number; uom?: string }[]
    gpsLatitude?: number
    gpsLongitude?: number
    customerConfirmed?: boolean
    notes?: string
  }): Promise<FreeSampleDistribution> {
    const res = await frappeClient.call<FreeSampleDistribution>(
      'base_meena.stock_management.doctype.free_sample_distribution.free_sample_distribution.distribute_samples',
      {
        sales_person: params.salesPerson,
        customer: params.customer,
        items: JSON.stringify(params.items),
        gps_latitude: params.gpsLatitude || 0,
        gps_longitude: params.gpsLongitude || 0,
        customer_confirmed: params.customerConfirmed ? 1 : 0,
        notes: params.notes || '',
      }
    )
    return res?.message as FreeSampleDistribution
  },

  /** Get distribution history for a sales person, optionally filtered by customer */
  async getDistributionHistory(salesPerson: string, customer?: string, limit?: number): Promise<FreeSampleDistribution[]> {
    const res = await frappeClient.call<FreeSampleDistribution[]>(
      'base_meena.stock_management.doctype.free_sample_distribution.free_sample_distribution.get_distribution_history',
      {
        sales_person: salesPerson,
        customer: customer || '',
        limit: limit || 20,
      }
    )
    return res?.message || []
  },

  /** Get all allocations (for admin) - uses frappe.client.get_list */
  async getAllAllocations(): Promise<FreeSampleAllocation[]> {
    const res = await frappeClient.getList<FreeSampleAllocation>(
      'Free Sample Allocation',
      {
        fields: ['name', 'item_code', 'item_name', 'status', 'allow_all_customers',
          'max_qty_per_customer', 'max_distributions_per_month', 'notes',
          'creation', 'modified'],
        filters: [['Free Sample Allocation', 'docstatus', '!=', 2]],
        order_by: 'creation desc',
        limit_page_length: 100,
      }
    )
    return res || []
  },
}
