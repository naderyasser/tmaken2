/**
 * Cashier Module API Client — v3
 * No POS Profile dependency. All config from Cashier Settings Single DocType.
 *
 * Fixes: D4 (multi-payment close), D7 (searchCustomers via custom API)
 */

import { frappeClient } from './api-client'

const CMD = (fn: string) => `erpnext.accounts.pos_cashier_api.${fn}`

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CashierPaymentMethod {
  mode_of_payment: string
  is_default: boolean
}

export interface CashierTax {
  tax_name: string
  rate: number
}

export interface CashierUserOverride {
  user: string
  warehouse?: string
  price_list?: string
}

export interface CashierSettings {
  company: string
  default_warehouse?: string
  selling_price_list?: string
  taxes: CashierTax[]
  track_stock: boolean
  currency: string
  payment_methods: CashierPaymentMethod[]
  user_overrides?: CashierUserOverride[]
  /** Returns above this amount require supervisor auth. 0 = never require auth. Default 200. */
  return_auth_threshold: number
}

export interface CashierSession {
  name: string
  user: string
  employee?: string
  company: string
  status: 'Active' | 'Closed' | 'Cancelled'
  session_start: string
  session_end?: string
  opening_cash: number
  expected_cash: number
  closing_cash: number
  variance: number
  shift_assignment?: string
}

export interface CartItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  amount?: number
  warehouse?: string
  discount_percentage?: number
}

/**
 * Proof that a card payment was actually authorised, as returned by the payment
 * terminal (or typed by a cashier when the terminal was unreachable — `manual`).
 *
 * This is what makes a card row reconcilable against the acquirer's settlement file.
 * `maskedPan` is already masked by the terminal; a full card number is never accepted
 * here and is scrubbed server-side if a driver ever sends one.
 */
export interface PaymentReference {
  /** Retrieval Reference Number — the acquirer's handle for the transaction. */
  rrn?: string
  authCode?: string
  maskedPan?: string
  scheme?: string
  cardType?: string
  terminalId?: string
  merchantId?: string
  stan?: string
  batchNo?: string
  responseCode?: string
  /** What the terminal authorised — may differ from the requested amount. */
  approvedAmount?: number
  at?: string
  /** Correlation key linking this payment to the till's local terminal journal. */
  clientRef?: string
  /** True when a human keyed the approval because the terminal/bridge was down. */
  manual?: boolean
  /**
   * The money is confirmed TAKEN and the amount is no longer editable.
   *
   * Distinct from `manual`, because the two cross: a cashier confirming an approval the
   * terminal could not report is manual AND settled, while a reference typed purely for
   * the shop's own records (terminal integration switched off) is manual and NOT settled
   * — that one is a note, and the cashier may still correct the amount.
   */
  settled?: boolean
}

export interface PaymentEntry {
  mode_of_payment: string
  amount: number
  /** Present only for payments settled on a card terminal. */
  reference?: PaymentReference
}

export interface POSInvoice {
  name: string
  customer: string
  customer_name?: string
  company?: string
  grand_total: number
  total?: number
  discount_amount?: number
  total_taxes_and_charges?: number
  change_amount?: number
  posting_date: string
  posting_time?: string
  cashier_session?: string
  status?: string
  items?: CartItem[]
  payments?: PaymentEntry[]
}

export interface CatalogItem {
  barcodes?: string[]
  name: string
  item_code: string
  item_name: string
  item_group?: string
  stock_uom?: string
  has_variants?: number
  image?: string
  rate: number
  actual_qty?: number | null
}

export interface DailySummary {
  date: string
  total_sales: number
  invoice_count: number
  total_returns: number
  net_sales: number
  payment_breakdown?: Array<{ mode_of_payment: string; amount: number }>  // G13
  top_items?: Array<{ item_code: string; item_name: string; qty: number; amount: number }>  // G13
  // enriched aggregation (additive — reports screen)
  returns_count?: number
  avg_basket?: number
  hourly?: Array<{ hour: string; count: number; total: number }>
}

export interface ReturnableItem {
  item_code: string
  item_name: string
  qty: number
  rate: number
  amount: number
  already_returned: number
  returnable_qty: number
  image?: string
}

export interface CashMovement {
  name?: string
  session_id: string
  type: 'in' | 'out'
  amount: number
  reason: string
  note?: string
  created_at?: string
}

export interface InvoiceForReturn {
  invoice: {
    name: string
    customer: string
    posting_date: string
    grand_total: number
    currency: string
  }
  items: ReturnableItem[]
  payments: PaymentEntry[]
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

async function call<T = unknown>(method: string, args?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await frappeClient.call(method, args || {}, signal)
  if (res.exc) {
    // res.exc is a JSON array of traceback strings — extract the last line
    // which contains the human-readable exception message
    try {
      const tracebacks: string[] = JSON.parse(res.exc)
      const last = tracebacks[tracebacks.length - 1] ?? ''
      const lastLine = last.trim().split('\n').filter(Boolean).pop() ?? last
      const colonIdx = lastLine.indexOf(': ')
      if (colonIdx !== -1 && /^[\w.]+$/.test(lastLine.slice(0, colonIdx))) {
        throw new Error(lastLine.slice(colonIdx + 2).trim())
      }
      throw new Error(lastLine)
    } catch (e) {
      if (e instanceof Error && e.message !== res.exc) throw e
    }
    throw new Error(String(res.exc).slice(0, 200))
  }
  return (res.message ?? res) as T
}

export const cashierApi = {
  /** Load Cashier Settings (with per-user overrides applied) */
  getSettings: () =>
    call<CashierSettings>(CMD('get_settings')),

  /** Save Cashier Settings — manager only */
  saveSettings: (data: Partial<CashierSettings> & { payment_methods?: CashierPaymentMethod[]; user_overrides?: CashierUserOverride[] }) =>
    call<{ success: boolean }>(CMD('save_settings'), { data }),

  /** Get or resume an active session */
  getActiveSession: () =>
    call<{ session: CashierSession | null; server_time?: string }>(CMD('get_active_session')),

  /** Open a new cashier session */
  openSession: (openingCash = 0) =>
    call<{ session: CashierSession }>(CMD('open_session'), { opening_cash: openingCash }),

  /** D4 fix: Close the active session with per-method closing amounts.
   *  `session` (optional) makes the call replay-safe: re-sending a queued close for an
   *  already-Closed session succeeds instead of throwing or closing a newer session. */
  closeSession: (closingAmounts: Record<string, number>, session?: string) =>
    call<{ session: CashierSession; duplicate?: boolean }>(CMD('close_session'), {
      closing_amounts: closingAmounts,
      session: session || null,
    }),

  /** Create a POS Invoice (sale). idempotency_key (client UUID) makes retries/replays
   *  return the SAME invoice; offline_created_at carries the true sale time for
   *  late-synced offline sales (server clamps it). */
  createSale: (params: {
    items: CartItem[]
    customer?: string
    payments?: PaymentEntry[]
    discount_amount?: number
    idempotency_key?: string
    offline_created_at?: string
  }) =>
    call<{ invoice: POSInvoice; duplicate?: boolean }>(CMD('create_sale'), {
      items: params.items,
      customer: params.customer || null,
      payments: params.payments || null,
      discount_amount: params.discount_amount || 0,
      idempotency_key: params.idempotency_key || null,
      offline_created_at: params.offline_created_at || null,
    }),

  /** Admin-only data hygiene: dry_run=true lists what WOULD be purged; armed run
   *  cancels/deletes test invoices and DISABLES (reversible) test items/customers. */
  purgeTestData: (dryRun: boolean) =>
    call<{
      invoices?: string[]
      invoice_details?: Array<{ name: string; owner: string; customer: string; posting_date: string; posting_time: string; grand_total: number; items: string[]; reasons: string[] }>
      items?: string[]
      customers?: string[]
      dry_run: boolean
      removed?: Record<string, number>
    }>(CMD('purge_test_data'), { dry_run: dryRun ? 1 : 0 }),

  /** Remove ONLY in-app self-test invoices (pos_client_ref like "selftest-%"). */
  selftestCleanup: () => call<{ removed: number }>(CMD('selftest_cleanup')),

  /** Get sales list */
  getSales: (params?: { date?: string; limit?: number; session?: string }) =>
    call<{ invoices: POSInvoice[] }>(CMD('get_sales'), {
      date: params?.date || null,
      limit: params?.limit ?? 20,
      session: params?.session || null,
    }),

  /** Load invoice items + returnable quantities for the return flow */
  getInvoiceForReturn: (invoiceName: string) =>
    call<InvoiceForReturn>(CMD('get_invoice_for_return'), { invoice_name: invoiceName }),

  /** Process a full or partial customer return */
  processReturn: (params: {
    invoice_name: string
    items?: Array<{ item_code: string; qty: number }>
    refund_payments?: PaymentEntry[]
    reason: string
  }) =>
    call<{ invoice: POSInvoice }>(CMD('process_return'), {
      invoice_name: params.invoice_name,
      items: params.items || null,
      refund_payments: params.refund_payments || null,
      reason: params.reason,
    }),

  /** Get daily summary — G13: includes payment breakdown */
  getSummary: (params?: { date?: string; to_date?: string; session?: string }) =>
    call<DailySummary>(CMD('get_summary'), {
      date: params?.date || null,
      to_date: params?.to_date || null,
      session: params?.session || null,
    }),

  /** Browse / search product catalog */
  getItems: (params?: { search?: string; group?: string; start?: number; limit?: number }, signal?: AbortSignal) =>
    call<{ items: CatalogItem[]; barcode_match?: boolean }>(CMD('get_items'), {
      search: params?.search || null,
      group: params?.group || null,
      start: params?.start ?? 0,
      limit: params?.limit ?? 40,
    }, signal),

  /** Barcode lookup — fast single-item lookup */
  barcodeLookup: (barcode: string) =>
    call<{ found: boolean; item?: CatalogItem }>(CMD('barcode_lookup'), { barcode }),

  /** Quick-add a new item from POS — G11: backend should check manager role */
  quickAddItem: (params: { item_name: string; rate?: number; barcode?: string; item_group?: string }) =>
    call<{ item: CatalogItem }>(CMD('quick_add_item'), params),

  /** D7 fix: Lookup customers via the custom cashier API (not raw Frappe) */
  searchCustomers: (query: string) =>
    call<Array<{ name: string; customer_name: string }>>(CMD('search_customers'), { query }),

  /** G3: Supervisor auth — validate supervisor credentials */
  validateSupervisor: (email: string, password: string) =>
    call<{ valid: boolean; name: string }>(CMD('validate_supervisor'), { email, password }),

  /** Fetch full POS Invoice detail with items and payments (for reprint) */
  getInvoiceDetail: async (invoiceName: string): Promise<{ invoice: POSInvoice }> => {
    const res = await frappeClient.get<POSInvoice>('POS Invoice', invoiceName)
    if (!res.data) throw new Error('Invoice not found: ' + invoiceName)
    return { invoice: res.data }
  },

  /** Void (cancel) a submitted POS Invoice */
  voidInvoice: (invoiceName: string) =>
    call<{ success: boolean }>(CMD('void_invoice'), { invoice_name: invoiceName }),

  /** Record a cash-in or cash-out movement during an active session */
  cashMovement: (params: { session_id: string; type: 'in' | 'out'; amount: number; reason: string; note?: string }) =>
    call<{ movement: CashMovement }>(CMD('cash_movement'), params),

  /** Get all cash movements for a given session */
  getSessionCashMovements: (sessionId: string) =>
    call<{ movements: CashMovement[] }>(CMD('get_session_cash_movements'), { session_id: sessionId }),

  /** Get the last N closed sessions for the current user */
  getLastClosedSessions: (limit = 3) =>
    call<{ sessions: CashierSession[] }>(CMD('get_last_closed_sessions'), { limit }),

  /** Get X-Report (mid-shift summary without closing) */
  getXReport: (sessionId: string) =>
    call<{
      session: CashierSession
      summary: DailySummary
      cash_movements: CashMovement[]
      total_cash_in: number
      total_cash_out: number
    }>(CMD('get_x_report'), { session_id: sessionId }),
}
