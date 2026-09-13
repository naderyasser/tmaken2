/**
 * Accounting Module API Client
 *
 * Connects exclusively to **standard ERPNext Accounting DocTypes**:
 *   Account, GL Entry, Journal Entry, Sales Invoice, Purchase Invoice,
 *   Payment Entry, Cost Center, Fiscal Year, Currency Exchange, etc.
 *
 * Follows the same patterns as purchase-api.ts / sales-api.ts.
 */

import { frappeClient, type FrappeRequestOptions, type FrappeFilter } from './api-client'
import { localToday } from './utils'

// ═══════════════════════════════════════════════════════════════════
// ██  TYPES
// ═══════════════════════════════════════════════════════════════════

// ── Account (Chart of Accounts) ─────────────────────────────────────

export type AccountType =
    | 'Accumulated Depreciation'
    | 'Asset Received But Not Billed'
    | 'Bank'
    | 'Cash'
    | 'Chargeable'
    | 'Capital Work in Progress'
    | 'Cost of Goods Sold'
    | 'Depreciation'
    | 'Equity'
    | 'Expense Account'
    | 'Expenses Included In Asset Valuation'
    | 'Expenses Included In Valuation'
    | 'Fixed Asset'
    | 'Income Account'
    | 'Payable'
    | 'Receivable'
    | 'Round Off'
    | 'Stock'
    | 'Stock Adjustment'
    | 'Stock Received But Not Billed'
    | 'Tax'
    | 'Temporary'

export type AccountRootType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'

export interface Account {
    name: string
    account_name: string
    account_number?: string
    parent_account?: string
    account_type?: AccountType
    root_type?: AccountRootType
    report_type?: 'Balance Sheet' | 'Profit and Loss'
    account_currency?: string
    company: string
    is_group?: number
    disabled?: number
    lft?: number
    rgt?: number
    // balance (virtual – computed by report API, not stored on doc)
    balance?: number
    creation?: string
    modified?: string
}

// ── GL Entry ─────────────────────────────────────────────────────────

export interface GLEntry {
    name: string
    posting_date: string
    account: string
    account_currency?: string
    against?: string
    debit?: number
    credit?: number
    debit_in_account_currency?: number
    credit_in_account_currency?: number
    voucher_type?: string
    voucher_no?: string
    cost_center?: string
    project?: string
    remarks?: string
    company: string
    is_cancelled?: number
    party_type?: string
    party?: string
    against_voucher_type?: string
    against_voucher?: string
    creation?: string
}

// ── Journal Entry ─────────────────────────────────────────────────────

export interface JournalEntryAccount {
    name?: string
    account: string
    account_currency?: string
    debit_in_account_currency?: number
    credit_in_account_currency?: number
    debit?: number
    credit?: number
    party_type?: string
    party?: string
    against_account?: string
    cost_center?: string
    project?: string
    reference_type?: string
    reference_name?: string
    user_remark?: string
}

export interface JournalEntry {
    name: string
    title?: string
    voucher_type?:
    | 'Journal Entry'
    | 'Bank Entry'
    | 'Cash Entry'
    | 'Credit Note'
    | 'Debit Note'
    | 'Opening Entry'
    | 'Contra Entry'
    | 'Excise Entry'
    | 'Write Off Entry'
    | 'Depreciation Entry'
    | 'Exchange Rate Revaluation'
    posting_date: string
    company: string
    total_debit?: number
    total_credit?: number
    user_remark?: string
    cheque_no?: string
    cheque_date?: string
    accounts?: JournalEntryAccount[]
    docstatus?: number
    creation?: string
    modified?: string
}

// ── Sales Invoice ─────────────────────────────────────────────────────

export interface SalesInvoiceItem {
    name?: string
    item_code: string
    item_name?: string
    description?: string
    qty: number
    rate: number
    amount?: number
    uom?: string
    income_account?: string
    cost_center?: string
    discount_amount?: number
    discount_percentage?: number
}

export interface SalesInvoiceTax {
    charge_type?: string
    account_head?: string
    description?: string
    rate?: number
    tax_amount?: number
    total?: number
}

export interface SalesInvoice {
    name: string
    title?: string
    customer: string
    customer_name?: string
    company: string
    posting_date: string
    due_date?: string
    status?: string
    grand_total?: number
    net_total?: number
    outstanding_amount?: number
    total_taxes_and_charges?: number
    currency?: string
    conversion_rate?: number
    items?: SalesInvoiceItem[]
    taxes?: SalesInvoiceTax[]
    docstatus?: number
    is_return?: number
    is_pos?: number
    debit_to?: string
    creation?: string
    modified?: string
}

// ── Purchase Invoice ──────────────────────────────────────────────────

export interface PurchaseInvoice {
    name: string
    title?: string
    supplier: string
    supplier_name?: string
    company: string
    posting_date: string
    due_date?: string
    status?: string
    grand_total?: number
    net_total?: number
    outstanding_amount?: number
    total_taxes_and_charges?: number
    currency?: string
    is_return?: number
    credit_to?: string
    docstatus?: number
    creation?: string
    modified?: string
}

// ── Payment Entry ─────────────────────────────────────────────────────

export interface PaymentEntryReference {
    name?: string
    reference_doctype?: string
    reference_name?: string
    total_amount?: number
    outstanding_amount?: number
    allocated_amount?: number
}

export interface PaymentEntry {
    name: string
    payment_type?: 'Receive' | 'Pay' | 'Internal Transfer'
    party_type?: 'Customer' | 'Supplier' | 'Employee' | 'Shareholder' | 'Student' | 'Member'
    party?: string
    party_name?: string
    company: string
    posting_date: string
    paid_amount?: number
    received_amount?: number
    difference_amount?: number
    paid_from?: string
    paid_to?: string
    paid_from_account_currency?: string
    paid_to_account_currency?: string
    mode_of_payment?: string
    reference_no?: string
    reference_date?: string
    references?: PaymentEntryReference[]
    docstatus?: number
    status?: string
    creation?: string
    modified?: string
}

// ── Cost Center ───────────────────────────────────────────────────────

export interface CostCenter {
    name: string
    cost_center_name: string
    parent_cost_center?: string
    company: string
    is_group?: number
    disabled?: number
}

// ── Fiscal Year ───────────────────────────────────────────────────────

export interface FiscalYear {
    name: string
    year_start_date: string
    year_end_date: string
    is_short_year?: number
    companies?: Array<{ company: string }>
}

// ── Currency Exchange ─────────────────────────────────────────────────

export interface CurrencyExchange {
    name: string
    date: string
    from_currency: string
    to_currency: string
    exchange_rate: number
}

// ── Budget ────────────────────────────────────────────────────────────

export interface BudgetAccount {
    name?: string
    account: string
    budget_amount: number
}

export interface Budget {
    name: string
    company: string
    fiscal_year: string
    cost_center?: string
    project?: string
    budget_against?: string
    action_if_annual_budget_exceeded?: string
    accounts?: BudgetAccount[]
    docstatus?: number
    creation?: string
    modified?: string
}

// ── Dashboard Summary ─────────────────────────────────────────────────

export interface AccountingDashboard {
    total_receivables: number
    total_payables: number
    bank_balances: Array<{ account: string; account_name: string; balance: number; currency: string }>
    cash_balances: Array<{ account: string; account_name: string; balance: number; currency: string }>
    revenue_ytd: number
    expense_ytd: number
    net_profit_ytd: number
    pending_sales_invoices: number
    pending_purchase_invoices: number
    overdue_sales_invoices: number
    overdue_purchase_invoices: number
    overdue_sales_amount: number
    overdue_purchase_amount: number
}

// ── Account Balance (from ERPNext report API) ─────────────────────────

export interface AccountBalance {
    account: string
    account_name: string
    balance: number
    debit: number
    credit: number
    currency: string
}

// ── Trial Balance Row ─────────────────────────────────────────────────

export interface TrialBalanceRow {
    account: string
    account_name?: string
    opening_debit?: number
    opening_credit?: number
    debit?: number
    credit?: number
    closing_debit?: number
    closing_credit?: number
    indent?: number
    parent_account?: string
}

// ── Profit & Loss Summary ─────────────────────────────────────────────

export interface ProfitLossSummary {
    income: number
    expense: number
    net_profit_loss: number
    income_accounts: AccountBalance[]
    expense_accounts: AccountBalance[]
}

// ── AR / AP Aging ─────────────────────────────────────────────────────

export interface AgingRow {
    party: string
    party_name?: string
    voucher_no?: string
    posting_date?: string
    due_date?: string
    invoiced?: number
    paid?: number
    credit_note?: number
    outstanding: number
    age?: number
    range1?: number   // 0-30 days
    range2?: number   // 31-60 days
    range3?: number   // 61-90 days
    range4?: number   // 91+ days
    currency?: string
}

// ── Cash Flow ─────────────────────────────────────────────────────────

export interface CashFlowRow {
    account?: string
    account_name?: string
    indent?: number
    amount?: number
    is_group?: boolean
}

// ── VAT ───────────────────────────────────────────────────────────────

export interface VATSummary {
    output_tax: number   // VAT collected from customers
    input_tax: number    // VAT paid to suppliers
    net_payable: number  // output - input (amount to pay ZATCA)
    output_entries: Array<{ date: string; voucher: string; party: string; amount: number }>
    input_entries: Array<{ date: string; voucher: string; party: string; amount: number }>
}

// ── Bank Reconciliation ───────────────────────────────────────────────

export interface BankStatement {
    account: string
    account_name: string
    balance_as_per_bank?: number
    balance_as_per_books?: number
    difference?: number
    uncleared_cheques?: number
    outstanding_deposits?: number
}

// ═══════════════════════════════════════════════════════════════════
// ██  HELPERS
// ═══════════════════════════════════════════════════════════════════

/** ISO-today string, e.g. "2026-04-01" — uses local calendar date (not UTC) */
const today = (): string => localToday()

// ── Server-side pagination support ────────────────────────────────────────────
// Shared filter builders: the get* list fns AND the count* fns below both build
// through these, so a page's rows and its pager total can never disagree.

function buildJournalEntryFilters(o: {
    company?: string; voucher_type?: string; from_date?: string; to_date?: string
    status?: 'Draft' | 'Submitted' | 'Cancelled'
}): FrappeFilter[] {
    const filters: FrappeFilter[] = []
    if (o.company) filters.push(['Journal Entry', 'company', '=', o.company])
    if (o.voucher_type) filters.push(['Journal Entry', 'voucher_type', '=', o.voucher_type])
    if (o.from_date) filters.push(['Journal Entry', 'posting_date', '>=', o.from_date])
    if (o.to_date) filters.push(['Journal Entry', 'posting_date', '<=', o.to_date])
    if (o.status === 'Submitted') filters.push(['Journal Entry', 'docstatus', '=', 1])
    else if (o.status === 'Draft') filters.push(['Journal Entry', 'docstatus', '=', 0])
    else if (o.status === 'Cancelled') filters.push(['Journal Entry', 'docstatus', '=', 2])
    return filters
}

function buildSalesInvoiceFilters(o: {
    company?: string; customer?: string; status?: string
    from_date?: string; to_date?: string; is_return?: boolean; overdue?: boolean
}): FrappeFilter[] {
    const filters: FrappeFilter[] = []
    if (o.company) filters.push(['Sales Invoice', 'company', '=', o.company])
    if (o.customer) filters.push(['Sales Invoice', 'customer', '=', o.customer])
    if (o.status) filters.push(['Sales Invoice', 'status', '=', o.status])
    if (o.from_date) filters.push(['Sales Invoice', 'posting_date', '>=', o.from_date])
    if (o.to_date) filters.push(['Sales Invoice', 'posting_date', '<=', o.to_date])
    if (o.is_return !== undefined) filters.push(['Sales Invoice', 'is_return', '=', o.is_return ? 1 : 0])
    if (o.overdue) {
        filters.push(['Sales Invoice', 'outstanding_amount', '>', 0])
        filters.push(['Sales Invoice', 'due_date', '<', today()])
        filters.push(['Sales Invoice', 'docstatus', '=', 1])
    }
    return filters
}

function buildPurchaseInvoiceFilters(o: {
    company?: string; supplier?: string; status?: string
    from_date?: string; to_date?: string; is_return?: boolean; overdue?: boolean
}): FrappeFilter[] {
    const filters: FrappeFilter[] = []
    if (o.company) filters.push(['Purchase Invoice', 'company', '=', o.company])
    if (o.supplier) filters.push(['Purchase Invoice', 'supplier', '=', o.supplier])
    if (o.status) filters.push(['Purchase Invoice', 'status', '=', o.status])
    if (o.from_date) filters.push(['Purchase Invoice', 'posting_date', '>=', o.from_date])
    if (o.to_date) filters.push(['Purchase Invoice', 'posting_date', '<=', o.to_date])
    if (o.is_return !== undefined) filters.push(['Purchase Invoice', 'is_return', '=', o.is_return ? 1 : 0])
    if (o.overdue) {
        filters.push(['Purchase Invoice', 'outstanding_amount', '>', 0])
        filters.push(['Purchase Invoice', 'due_date', '<', today()])
        filters.push(['Purchase Invoice', 'docstatus', '=', 1])
    }
    return filters
}

function buildPaymentEntryFilters(o: {
    company?: string; party_type?: string; party?: string
    payment_type?: 'Receive' | 'Pay' | 'Internal Transfer'
    from_date?: string; to_date?: string
}): FrappeFilter[] {
    const filters: FrappeFilter[] = []
    if (o.company) filters.push(['Payment Entry', 'company', '=', o.company])
    if (o.party_type) filters.push(['Payment Entry', 'party_type', '=', o.party_type])
    if (o.party) filters.push(['Payment Entry', 'party', '=', o.party])
    if (o.payment_type) filters.push(['Payment Entry', 'payment_type', '=', o.payment_type])
    if (o.from_date) filters.push(['Payment Entry', 'posting_date', '>=', o.from_date])
    if (o.to_date) filters.push(['Payment Entry', 'posting_date', '<=', o.to_date])
    return filters
}

/** Total matching docs. frappe.client.get_count has no or_filters support, so a
 *  search count falls back to a names-only unlimited list (search results are small). */
async function getDocCount(doctype: string, filters: FrappeFilter[], or_filters?: FrappeFilter[]): Promise<number> {
    if (or_filters?.length) {
        const names = await frappeClient.getList<{ name: string }>(doctype, {
            filters, or_filters, fields: ['name'], limit_page_length: 0,
        })
        return names.length
    }
    const resp = await frappeClient.call<number>('frappe.client.get_count', { doctype, filters })
    return typeof resp.message === 'number' ? resp.message : 0
}

// ═══════════════════════════════════════════════════════════════════
// ██  API
// ═══════════════════════════════════════════════════════════════════

export const accountingApi = {

    // ─────────────────────── Chart of Accounts ───────────────────────

    /**
     * List accounts. Optionally filter by root_type, account_type,
     * company, or whether the account is a leaf (is_group = 0).
     */
    async getAccounts(options?: FrappeRequestOptions & {
        company?: string
        root_type?: AccountRootType
        account_type?: AccountType
        is_group?: boolean
        disabled?: boolean
    }): Promise<Account[]> {
        const { company, root_type, account_type, is_group, disabled, ...rest } = options || {}
        const filters: FrappeFilter[] = []
        if (company) filters.push(['Account', 'company', '=', company])
        if (root_type) filters.push(['Account', 'root_type', '=', root_type])
        if (account_type) filters.push(['Account', 'account_type', '=', account_type])
        if (is_group !== undefined) filters.push(['Account', 'is_group', '=', is_group ? 1 : 0])
        if (disabled !== undefined) filters.push(['Account', 'disabled', '=', disabled ? 1 : 0])
        else filters.push(['Account', 'disabled', '=', 0])

        return frappeClient.getList<Account>('Account', {
            filters,
            fields: [
                'name', 'account_name', 'account_number', 'parent_account', 'account_type',
                'root_type', 'report_type', 'account_currency',
                'company', 'is_group', 'disabled', 'lft', 'rgt',
            ],
            order_by: 'lft asc',
            limit_page_length: 1000,
            ...rest,
        })
    },

    /** Fetch a single Account document. */
    async getAccount(name: string): Promise<Account> {
        const res = await frappeClient.get<Account>('Account', name)
        if (!res.data) throw new Error('Account not found')
        return res.data
    },

    /** Create an Account document in ERPNext. */
    async createAccount(data: {
        account_name: string
        company: string
        root_type: AccountRootType
        parent_account?: string
        account_type?: AccountType
        account_number?: string
        is_group?: boolean
        report_type?: 'Balance Sheet' | 'Profit and Loss'
    }): Promise<Account> {
        const inferredReportType =
            data.root_type === 'Income' || data.root_type === 'Expense'
                ? 'Profit and Loss'
                : 'Balance Sheet'

        const res = await frappeClient.post<Account>('Account', {
            account_name: data.account_name,
            company: data.company,
            root_type: data.root_type,
            parent_account: data.parent_account || undefined,
            account_type: data.account_type || undefined,
            account_number: data.account_number || undefined,
            is_group: data.is_group ? 1 : 0,
            report_type: data.report_type ?? inferredReportType,
        })

        if (!res.data) throw new Error('Failed to create Account')
        return res.data
    },

    /** Update an existing Account document in ERPNext. */
    async updateAccount(name: string, data: {
        account_name?: string
        company?: string
        root_type?: AccountRootType
        parent_account?: string
        account_type?: AccountType | string
        account_number?: string
        is_group?: boolean
        report_type?: 'Balance Sheet' | 'Profit and Loss'
        disabled?: boolean
    }): Promise<Account> {
        const payload: Record<string, unknown> = {}
        if (data.account_name !== undefined) payload.account_name = data.account_name
        if (data.company !== undefined) payload.company = data.company
        if (data.root_type !== undefined) payload.root_type = data.root_type
        if (data.parent_account !== undefined) payload.parent_account = data.parent_account || null
        if (data.account_type !== undefined) payload.account_type = data.account_type || null
        if (data.account_number !== undefined) payload.account_number = data.account_number || null
        if (data.is_group !== undefined) payload.is_group = data.is_group ? 1 : 0
        if (data.report_type !== undefined) payload.report_type = data.report_type
        if (data.disabled !== undefined) payload.disabled = data.disabled ? 1 : 0

        const res = await frappeClient.put<Account>('Account', name, payload)
        if (!res.data) throw new Error('Failed to update Account')
        return res.data
    },

    /**
     * Fetch only Bank or Cash accounts (useful for the bank balance widget).
     */
    async getBankCashAccounts(company?: string): Promise<Account[]> {
        const filters: FrappeFilter[] = [
            ['Account', 'account_type', 'in', ['Bank', 'Cash']],
            ['Account', 'is_group', '=', 0],
            ['Account', 'disabled', '=', 0],
        ]
        if (company) filters.push(['Account', 'company', '=', company])

        return frappeClient.getList<Account>('Account', {
            filters,
            fields: ['name', 'account_name', 'account_type', 'account_currency', 'company'],
            order_by: 'account_type asc, account_name asc',
            limit_page_length: 200,
        })
    },

    /**
     * Get Receivable or Payable control accounts.
     */
    async getControlAccounts(type: 'Receivable' | 'Payable', company?: string): Promise<Account[]> {
        const filters: FrappeFilter[] = [
            ['Account', 'account_type', '=', type],
            ['Account', 'is_group', '=', 0],
            ['Account', 'disabled', '=', 0],
        ]
        if (company) filters.push(['Account', 'company', '=', company])

        return frappeClient.getList<Account>('Account', {
            filters,
            fields: ['name', 'account_name', 'account_currency', 'company'],
            limit_page_length: 100,
        })
    },

    // ─────────────────────── GL Entries ───────────────────────────────

    /**
     * Fetch GL entries with rich filter options.
     * NOTE: GL entries are high-volume; always supply date range or voucher filters.
     */
    async getGLEntries(options?: FrappeRequestOptions & {
        account?: string
        company?: string
        from_date?: string
        to_date?: string
        voucher_type?: string
        voucher_no?: string
        party_type?: string
        party?: string
        is_cancelled?: boolean
    }): Promise<GLEntry[]> {
        const {
            account, company, from_date, to_date,
            voucher_type, voucher_no, party_type, party, is_cancelled,
            ...rest
        } = options || {}

        const filters: FrappeFilter[] = []
        if (company) filters.push(['GL Entry', 'company', '=', company])
        if (account) filters.push(['GL Entry', 'account', '=', account])
        if (from_date) filters.push(['GL Entry', 'posting_date', '>=', from_date])
        if (to_date) filters.push(['GL Entry', 'posting_date', '<=', to_date])
        if (voucher_type) filters.push(['GL Entry', 'voucher_type', '=', voucher_type])
        if (voucher_no) filters.push(['GL Entry', 'voucher_no', '=', voucher_no])
        if (party_type) filters.push(['GL Entry', 'party_type', '=', party_type])
        if (party) filters.push(['GL Entry', 'party', '=', party])
        if (is_cancelled !== undefined)
            filters.push(['GL Entry', 'is_cancelled', '=', is_cancelled ? 1 : 0])
        else filters.push(['GL Entry', 'is_cancelled', '=', 0])

        return frappeClient.getList<GLEntry>('GL Entry', {
            filters,
            fields: [
                'name', 'posting_date', 'account', 'account_currency',
                'against', 'debit', 'credit',
                'debit_in_account_currency', 'credit_in_account_currency',
                'voucher_type', 'voucher_no',
                'cost_center', 'project', 'remarks',
                'party_type', 'party',
                'against_voucher_type', 'against_voucher',
                'company', 'creation',
            ],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: rest.limit_page_length ?? 500,
            ...rest,
        })
    },

    /**
     * Get all GL entries for a specific voucher (e.g., a Sales Invoice).
     * Great for the "Accounting Ledger" view inside a document.
     */
    async getVoucherLedger(voucherType: string, voucherNo: string): Promise<GLEntry[]> {
        return this.getGLEntries({ voucher_type: voucherType, voucher_no: voucherNo })
    },

    // ─────────────────────── Account Balance ─────────────────────────

    /**
     * Compute the running balance of an account between two dates.
     * Uses ERPNext's built-in `get_balance` whitelisted method.
     */
    async getAccountBalance(
        account: string,
        date?: string,
        company?: string
    ): Promise<number> {
        try {
            const resp = await frappeClient.call<number>(
                'erpnext.accounts.utils.get_balance_on',
                { account, date: date ?? today(), company }
            )
            return (resp.message as number) ?? 0
        } catch {
            return 0
        }
    },

    /**
     * Batch-fetch balances for multiple accounts.
     * Falls back to individual calls if the server doesn't support batch.
     */
    async getMultipleBalances(
        accounts: string[],
        date?: string,
        company?: string
    ): Promise<AccountBalance[]> {
        const balances = await Promise.allSettled(
            accounts.map(async (acct) => {
                const bal = await this.getAccountBalance(acct, date, company)
                return { account: acct, account_name: acct, balance: bal, debit: 0, credit: 0, currency: '' }
            })
        )
        return balances
            .filter((r): r is PromiseFulfilledResult<AccountBalance> => r.status === 'fulfilled')
            .map(r => r.value)
    },

    // ─────────────────────── Journal Entries ──────────────────────────

    async getJournalEntries(options?: FrappeRequestOptions & {
        company?: string
        voucher_type?: string
        from_date?: string
        to_date?: string
        status?: 'Draft' | 'Submitted' | 'Cancelled'
    }): Promise<JournalEntry[]> {
        const { company, voucher_type, from_date, to_date, status, filters: callerFilters, ...rest } = options || {}
        const filters = buildJournalEntryFilters({ company, voucher_type, from_date, to_date, status })

        return frappeClient.getList<JournalEntry>('Journal Entry', {
            filters: [...filters, ...(callerFilters ?? [])],
            fields: [
                'name', 'title', 'voucher_type', 'posting_date', 'company',
                'total_debit', 'total_credit', 'user_remark',
                'cheque_no', 'cheque_date', 'docstatus',
                'creation', 'modified',
            ],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    /** Total matching journal entries — same filter builder as getJournalEntries, so the
     *  pager's total can never disagree with the list. */
    async countJournalEntries(options?: {
        company?: string
        voucher_type?: string
        from_date?: string
        to_date?: string
        status?: 'Draft' | 'Submitted' | 'Cancelled'
        filters?: FrappeFilter[]
        or_filters?: FrappeFilter[]
    }): Promise<number> {
        const { filters: callerFilters, or_filters, ...opts } = options || {}
        return getDocCount('Journal Entry', [...buildJournalEntryFilters(opts), ...(callerFilters ?? [])], or_filters)
    },

    async getJournalEntry(name: string): Promise<JournalEntry> {
        const res = await frappeClient.get<JournalEntry>('Journal Entry', name)
        if (!res.data) throw new Error('Journal Entry not found')
        return res.data
    },

    async createJournalEntry(data: {
        company: string
        posting_date?: string
        voucher_type?: JournalEntry['voucher_type']
        user_remark?: string
        cheque_no?: string
        cheque_date?: string
        accounts: Array<{
            account: string
            debit_in_account_currency?: number
            credit_in_account_currency?: number
            party_type?: string
            party?: string
            cost_center?: string
            reference_type?: string
            reference_name?: string
            user_remark?: string
        }>
    }): Promise<JournalEntry> {
        const res = await frappeClient.post<JournalEntry>('Journal Entry', {
            voucher_type: 'Journal Entry',
            posting_date: today(),
            ...data,
        })
        if (!res.data) throw new Error('Failed to create Journal Entry')
        return res.data
    },

    async submitJournalEntry(name: string): Promise<JournalEntry> {
        const docRes = await frappeClient.get<JournalEntry>('Journal Entry', name)
        const doc = docRes.data
        if (!doc) throw new Error('Journal Entry not found: ' + name)
        const resp = await frappeClient.call<JournalEntry>('frappe.client.submit', { doc: { ...doc, doctype: 'Journal Entry' } })
        return resp.message || resp.data || doc
    },

    async cancelJournalEntry(name: string): Promise<JournalEntry> {
        const resp = await frappeClient.call<JournalEntry>('frappe.client.cancel', { doctype: 'Journal Entry', name })
        return resp.message || resp.data || ({} as JournalEntry)
    },

    async deleteJournalEntry(name: string): Promise<void> {
        await frappeClient.delete('Journal Entry', name)
    },

    // ─────────────────────── Sales Invoices ───────────────────────────

    async getSalesInvoices(options?: FrappeRequestOptions & {
        company?: string
        customer?: string
        status?: string
        from_date?: string
        to_date?: string
        is_return?: boolean
        overdue?: boolean
    }): Promise<SalesInvoice[]> {
        const { company, customer, status, from_date, to_date, is_return, overdue, filters: callerFilters, ...rest } = options || {}
        const filters = buildSalesInvoiceFilters({ company, customer, status, from_date, to_date, is_return, overdue })

        return frappeClient.getList<SalesInvoice>('Sales Invoice', {
            filters: [...filters, ...(callerFilters ?? [])],
            fields: [
                'name', 'title', 'customer', 'customer_name', 'company',
                'posting_date', 'due_date', 'status',
                'grand_total', 'net_total', 'outstanding_amount',
                'total_taxes_and_charges', 'currency',
                'is_return', 'is_pos', 'docstatus',
                'creation', 'modified',
            ],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async countSalesInvoices(options?: {
        company?: string; customer?: string; status?: string
        from_date?: string; to_date?: string; is_return?: boolean; overdue?: boolean
        filters?: FrappeFilter[]; or_filters?: FrappeFilter[]
    }): Promise<number> {
        const { filters: callerFilters, or_filters, ...opts } = options || {}
        return getDocCount('Sales Invoice', [...buildSalesInvoiceFilters(opts), ...(callerFilters ?? [])], or_filters)
    },

    async getSalesInvoice(name: string): Promise<SalesInvoice> {
        const res = await frappeClient.get<SalesInvoice>('Sales Invoice', name)
        if (!res.data) throw new Error('Sales Invoice not found')
        return res.data
    },

    async submitSalesInvoice(name: string): Promise<SalesInvoice> {
        const docRes = await frappeClient.get<SalesInvoice>('Sales Invoice', name)
        const doc = docRes.data
        if (!doc) throw new Error('Sales Invoice not found: ' + name)
        const resp = await frappeClient.call<SalesInvoice>('frappe.client.submit', { doc: { ...doc, doctype: 'Sales Invoice' } })
        return resp.message || resp.data || doc
    },

    async cancelSalesInvoice(name: string): Promise<SalesInvoice> {
        const resp = await frappeClient.call<SalesInvoice>('frappe.client.cancel', { doctype: 'Sales Invoice', name })
        return resp.message || resp.data || ({} as SalesInvoice)
    },

    // ─────────────────────── Purchase Invoices ────────────────────────

    async getPurchaseInvoices(options?: FrappeRequestOptions & {
        company?: string
        supplier?: string
        status?: string
        from_date?: string
        to_date?: string
        is_return?: boolean
        overdue?: boolean
    }): Promise<PurchaseInvoice[]> {
        const { company, supplier, status, from_date, to_date, is_return, overdue, filters: callerFilters, ...rest } = options || {}
        const filters = buildPurchaseInvoiceFilters({ company, supplier, status, from_date, to_date, is_return, overdue })

        return frappeClient.getList<PurchaseInvoice>('Purchase Invoice', {
            filters: [...filters, ...(callerFilters ?? [])],
            fields: [
                'name', 'title', 'supplier', 'supplier_name', 'company',
                'posting_date', 'due_date', 'status',
                'grand_total', 'net_total', 'outstanding_amount',
                'total_taxes_and_charges', 'currency',
                'is_return', 'docstatus',
                'creation', 'modified',
            ],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async countPurchaseInvoices(options?: {
        company?: string; supplier?: string; status?: string
        from_date?: string; to_date?: string; is_return?: boolean; overdue?: boolean
        filters?: FrappeFilter[]; or_filters?: FrappeFilter[]
    }): Promise<number> {
        const { filters: callerFilters, or_filters, ...opts } = options || {}
        return getDocCount('Purchase Invoice', [...buildPurchaseInvoiceFilters(opts), ...(callerFilters ?? [])], or_filters)
    },

    async getPurchaseInvoice(name: string): Promise<PurchaseInvoice> {
        const res = await frappeClient.get<PurchaseInvoice>('Purchase Invoice', name)
        if (!res.data) throw new Error('Purchase Invoice not found')
        return res.data
    },

    // ── Receivables / Payables aggregate helpers ──────────────────────

    /**
     * Get total outstanding receivables (unpaid issued invoices).
     * Sums `outstanding_amount` of submitted, unpaid Sales Invoices.
     */
    async getTotalReceivables(company?: string): Promise<number> {
        const invoices = await this.getSalesInvoices({
            company,
            // docstatus 1, outstanding_amount > 0 — company handled by the company param above
            filters: [
                ['Sales Invoice', 'docstatus', '=', 1],
                ['Sales Invoice', 'outstanding_amount', '>', 0],
                ['Sales Invoice', 'is_return', '=', 0],
            ] as FrappeFilter[],
            fields: ['outstanding_amount'],
            limit_page_length: 5000,
        })
        return invoices.reduce((sum, inv) => sum + (inv.outstanding_amount ?? 0), 0)
    },

    /**
     * Get total outstanding payables (unpaid received purchase invoices).
     */
    async getTotalPayables(company?: string): Promise<number> {
        const invoices = await frappeClient.getList<{ outstanding_amount?: number }>('Purchase Invoice', {
            filters: [
                ['Purchase Invoice', 'docstatus', '=', 1],
                ['Purchase Invoice', 'outstanding_amount', '>', 0],
                ['Purchase Invoice', 'is_return', '=', 0],
                ...(company ? [['Purchase Invoice', 'company', '=', company] as FrappeFilter] : []),
            ],
            fields: ['outstanding_amount'],
            limit_page_length: 5000,
        })
        return invoices.reduce((sum, inv) => sum + (inv.outstanding_amount ?? 0), 0)
    },

    // ─────────────────────── Payment Entries ──────────────────────────

    async getPaymentEntries(options?: FrappeRequestOptions & {
        company?: string
        party_type?: string
        party?: string
        payment_type?: 'Receive' | 'Pay' | 'Internal Transfer'
        from_date?: string
        to_date?: string
    }): Promise<PaymentEntry[]> {
        const { company, party_type, party, payment_type, from_date, to_date, filters: callerFilters, ...rest } = options || {}
        const filters = buildPaymentEntryFilters({ company, party_type, party, payment_type, from_date, to_date })

        return frappeClient.getList<PaymentEntry>('Payment Entry', {
            filters: [...filters, ...(callerFilters ?? [])],
            fields: [
                'name', 'payment_type', 'party_type', 'party', 'party_name',
                'company', 'posting_date', 'paid_amount', 'received_amount',
                'paid_from', 'paid_to', 'mode_of_payment',
                'reference_no', 'reference_date',
                'docstatus', 'status', 'creation', 'modified',
            ],
            order_by: 'posting_date desc, creation desc',
            limit_page_length: 200,
            ...rest,
        })
    },

    async countPaymentEntries(options?: {
        company?: string; party_type?: string; party?: string
        payment_type?: 'Receive' | 'Pay' | 'Internal Transfer'
        from_date?: string; to_date?: string
        filters?: FrappeFilter[]; or_filters?: FrappeFilter[]
    }): Promise<number> {
        const { filters: callerFilters, or_filters, ...opts } = options || {}
        return getDocCount('Payment Entry', [...buildPaymentEntryFilters(opts), ...(callerFilters ?? [])], or_filters)
    },

    async getPaymentEntry(name: string): Promise<PaymentEntry> {
        const res = await frappeClient.get<PaymentEntry>('Payment Entry', name)
        if (!res.data) throw new Error('Payment Entry not found')
        return res.data
    },

    async createPaymentEntry(data: {
        payment_type: 'Receive' | 'Pay' | 'Internal Transfer'
        party_type: NonNullable<PaymentEntry['party_type']>
        party: string
        company: string
        posting_date?: string
        paid_amount: number
        received_amount?: number
        paid_from: string
        paid_to: string
        mode_of_payment?: string
        reference_no?: string
        reference_date?: string
        references?: Array<{
            reference_doctype: string
            reference_name: string
            allocated_amount: number
        }>
    }): Promise<PaymentEntry> {
        const res = await frappeClient.post<PaymentEntry>('Payment Entry', {
            posting_date: today(),
            ...data,
        })
        if (!res.data) throw new Error('Failed to create Payment Entry')
        return res.data
    },

    async submitPaymentEntry(name: string): Promise<PaymentEntry> {
        const docRes = await frappeClient.get<PaymentEntry>('Payment Entry', name)
        const doc = docRes.data
        if (!doc) throw new Error('Payment Entry not found: ' + name)
        const resp = await frappeClient.call<PaymentEntry>('frappe.client.submit', { doc: { ...doc, doctype: 'Payment Entry' } })
        return resp.message || resp.data || doc
    },

    async cancelPaymentEntry(name: string): Promise<PaymentEntry> {
        const resp = await frappeClient.call<PaymentEntry>('frappe.client.cancel', { doctype: 'Payment Entry', name })
        return resp.message || resp.data || ({} as PaymentEntry)
    },

    // ─────────────────────── Cost Centers ─────────────────────────────

    async getCostCenters(company?: string): Promise<CostCenter[]> {
        const filters: FrappeFilter[] = [['Cost Center', 'disabled', '=', 0]]
        if (company) filters.push(['Cost Center', 'company', '=', company])

        return frappeClient.getList<CostCenter>('Cost Center', {
            filters,
            fields: ['name', 'cost_center_name', 'parent_cost_center', 'company', 'is_group'],
            order_by: 'lft asc',
            limit_page_length: 500,
        })
    },

    // ─────────────────────── Fiscal Year ──────────────────────────────

    async getFiscalYears(): Promise<FiscalYear[]> {
        return frappeClient.getList<FiscalYear>('Fiscal Year', {
            fields: ['name', 'year_start_date', 'year_end_date', 'is_short_year'],
            order_by: 'year_start_date desc',
            limit_page_length: 20,
        })
    },

    /** Returns the currently active fiscal year based on today's date. */
    async getCurrentFiscalYear(company?: string): Promise<FiscalYear | null> {
        try {
            const resp = await frappeClient.call<FiscalYear>(
                'erpnext.accounts.utils.get_fiscal_year',
                { date: today(), company, as_dict: 1 }
            )
            return resp.message ?? null
        } catch {
            return null
        }
    },

    /**
     * Returns the active fiscal year for `company`.
     * Queries the Fiscal Year doctype filtered to the current calendar date.
     * Falls back to Jan 1 of the current year when ERPNext returns no match
     * (e.g. fiscal year not yet configured), so callers always get a valid date.
     */
    async getFiscalYear(company: string): Promise<FiscalYear> {
        try {
            const list = await frappeClient.getList<FiscalYear>('Fiscal Year', {
                filters: [
                    ['Fiscal Year', 'company', '=', company],
                    ['Fiscal Year', 'year_start_date', '<=', today()],
                    ['Fiscal Year', 'year_end_date', '>=', today()],
                ],
                fields: ['name', 'year_start_date', 'year_end_date'],
                limit_page_length: 1,
                order_by: 'year_start_date desc',
            })
            if (Array.isArray(list) && list.length > 0) return list[0]
        } catch {
            // fall through to default
        }
        const year = new Date().getFullYear()
        return { name: String(year), year_start_date: `${year}-01-01`, year_end_date: `${year}-12-31` }
    },

    // ─────────────────────── Currency Exchange ─────────────────────────

    async getCurrencyExchangeRate(
        from_currency: string,
        to_currency: string,
        date?: string
    ): Promise<number> {
        try {
            const resp = await frappeClient.call<number>(
                'erpnext.setup.utils.get_exchange_rate',
                { from_currency, to_currency, transaction_date: date ?? today() }
            )
            return (resp.message as number) ?? 1
        } catch { return 1 }
    },

    // ─────────────────────── Budgets ──────────────────────────────────

    async getBudgets(options?: FrappeRequestOptions & {
        company?: string
        fiscal_year?: string
    }): Promise<Budget[]> {
        const { company, fiscal_year, ...rest } = options || {}
        const filters: FrappeFilter[] = []
        if (company) filters.push(['Budget', 'company', '=', company])
        if (fiscal_year) filters.push(['Budget', 'fiscal_year', '=', fiscal_year])

        return frappeClient.getList<Budget>('Budget', {
            filters,
            fields: [
                'name', 'company', 'fiscal_year', 'cost_center',
                'project', 'budget_against', 'docstatus',
                'creation', 'modified',
            ],
            order_by: 'fiscal_year desc, creation desc',
            limit_page_length: 100,
            ...rest,
        })
    },

    // ─────────────────────── Reports (ERPNext built-in) ───────────────

    /**
     * Fetch the Trial Balance report data via ERPNext's report runner.
     * Returns structured row data.
     */
    async getTrialBalance(params: {
        company: string
        fiscal_year: string
        from_date?: string
        to_date?: string
        with_period_closing_entry?: boolean
        cost_center?: string
    }): Promise<TrialBalanceRow[]> {
        const filters: Record<string, any> = {
            company: params.company,
            fiscal_year: params.fiscal_year,
            from_date: params.from_date ?? (await this.getFiscalYear(params.company)).year_start_date,
            to_date: params.to_date ?? today(),
            with_period_closing_entry: params.with_period_closing_entry ? 1 : 0,
        }
        if (params.cost_center) filters.cost_center = params.cost_center
        const resp = await frappeClient.call<{ result: TrialBalanceRow[] }>(
            'frappe.desk.query_report.run',
            { report_name: 'Trial Balance', filters }
        )

        const rows = resp.message?.result
        if (!Array.isArray(rows)) {
            throw new Error('Invalid Trial Balance response')
        }
        return rows
    },

    /**
     * Fetch the Balance Sheet report data via ERPNext's report runner.
     */
    async getBalanceSheetReport(params: {
        company: string
        fiscal_year: string
        period_start_date?: string
        period_end_date?: string
        periodicity?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'
        cost_center?: string
    }): Promise<TrialBalanceRow[]> {
        const filters: Record<string, any> = {
            company: params.company,
            fiscal_year: params.fiscal_year,
            period_start_date: params.period_start_date ?? (await this.getFiscalYear(params.company)).year_start_date,
            period_end_date: params.period_end_date ?? today(),
            periodicity: params.periodicity ?? 'Yearly',
        }
        if (params.cost_center) filters.cost_center = params.cost_center
        const resp = await frappeClient.call<{ result: TrialBalanceRow[] }>(
            'frappe.desk.query_report.run',
            { report_name: 'Balance Sheet', filters }
        )

        const rows = resp.message?.result
        if (!Array.isArray(rows)) {
            throw new Error('Invalid Balance Sheet response')
        }
        return rows
    },

    /**
     * Fetch the Profit and Loss report data via ERPNext's report runner.
     */
    async getProfitAndLossReport(params: {
        company: string
        fiscal_year: string
        from_date?: string
        to_date?: string
        periodicity?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'
        cost_center?: string
    }): Promise<TrialBalanceRow[]> {
        const filters: Record<string, any> = {
            company: params.company,
            fiscal_year: params.fiscal_year,
            from_date: params.from_date ?? (await this.getFiscalYear(params.company)).year_start_date,
            to_date: params.to_date ?? today(),
            periodicity: params.periodicity ?? 'Yearly',
        }
        if (params.cost_center) filters.cost_center = params.cost_center
        const resp = await frappeClient.call<{ result: TrialBalanceRow[] }>(
            'frappe.desk.query_report.run',
            { report_name: 'Profit and Loss Statement', filters }
        )

        const rows = resp.message?.result
        if (!Array.isArray(rows)) {
            throw new Error('Invalid Profit and Loss response')
        }
        return rows
    },

    /**
     * Fetch a General Ledger report.
     */
    async getGeneralLedgerReport(params: {
        company: string
        from_date: string
        to_date: string
        account?: string
        party_type?: string
        party?: string
        voucher_no?: string
        group_by?: string
        cost_center?: string
    }): Promise<GLEntry[]> {
        const filters: Record<string, any> = {
            company: params.company,
            from_date: params.from_date,
            to_date: params.to_date,
            account: params.account ?? '',
            party_type: params.party_type ?? '',
            party: params.party ?? '',
            voucher_no: params.voucher_no ?? '',
            group_by: params.group_by ?? 'Group by Voucher (Consolidated)',
        }
        if (params.cost_center) filters.cost_center = params.cost_center
        const resp = await frappeClient.call<{ result: GLEntry[] }>(
            'frappe.desk.query_report.run',
            { report_name: 'General Ledger', filters }
        )

        const rows = resp.message?.result
        if (!Array.isArray(rows)) {
            throw new Error('Invalid General Ledger response')
        }
        return rows
    },

    // ─────────────────────── Dashboard Aggregate ──────────────────────

    /**
     * Assemble an `AccountingDashboard` snapshot.
     * All sub-calls are parallelised for speed.
     */
    async getDashboard(company?: string): Promise<AccountingDashboard> {
        const dateToday = today()

        // Bank & Cash accounts
        const bankCashAccounts = await this.getBankCashAccounts(company)
        const bankAccounts = bankCashAccounts.filter(a => a.account_type === 'Bank')
        const cashAccounts = bankCashAccounts.filter(a => a.account_type === 'Cash')

        // Run everything in parallel
        const [
            totalReceivables,
            totalPayables,
            bankBalanceResults,
            cashBalanceResults,
            pendingSales,
            pendingPurchases,
            overdueSales,
            overduePurchases,
        ] = await Promise.allSettled([
            this.getTotalReceivables(company),
            this.getTotalPayables(company),
            Promise.all(bankAccounts.map(async a => ({
                account: a.name,
                account_name: a.account_name,
                balance: await this.getAccountBalance(a.name, dateToday, company),
                currency: a.account_currency ?? 'SAR',
            }))),
            Promise.all(cashAccounts.map(async a => ({
                account: a.name,
                account_name: a.account_name,
                balance: await this.getAccountBalance(a.name, dateToday, company),
                currency: a.account_currency ?? 'SAR',
            }))),
            // Pending (submitted, not fully paid)
            frappeClient.getList<{ name: string }>('Sales Invoice', {
                filters: [
                    ['Sales Invoice', 'docstatus', '=', 1],
                    ['Sales Invoice', 'outstanding_amount', '>', 0],
                    ['Sales Invoice', 'is_return', '=', 0],
                    ...(company ? [['Sales Invoice', 'company', '=', company] as FrappeFilter] : []),
                ],
                fields: ['name'],
                limit_page_length: 5000,
            }),
            frappeClient.getList<{ name: string }>('Purchase Invoice', {
                filters: [
                    ['Purchase Invoice', 'docstatus', '=', 1],
                    ['Purchase Invoice', 'outstanding_amount', '>', 0],
                    ['Purchase Invoice', 'is_return', '=', 0],
                    ...(company ? [['Purchase Invoice', 'company', '=', company] as FrappeFilter] : []),
                ],
                fields: ['name'],
                limit_page_length: 5000,
            }),
            // Overdue
            frappeClient.getList<{ name: string; outstanding_amount?: number }>('Sales Invoice', {
                filters: [
                    ['Sales Invoice', 'docstatus', '=', 1],
                    ['Sales Invoice', 'outstanding_amount', '>', 0],
                    ['Sales Invoice', 'due_date', '<', dateToday],
                    ['Sales Invoice', 'is_return', '=', 0],
                    ...(company ? [['Sales Invoice', 'company', '=', company] as FrappeFilter] : []),
                ],
                fields: ['name', 'outstanding_amount'],
                limit_page_length: 5000,
            }),
            frappeClient.getList<{ name: string; outstanding_amount?: number }>('Purchase Invoice', {
                filters: [
                    ['Purchase Invoice', 'docstatus', '=', 1],
                    ['Purchase Invoice', 'outstanding_amount', '>', 0],
                    ['Purchase Invoice', 'due_date', '<', dateToday],
                    ['Purchase Invoice', 'is_return', '=', 0],
                    ...(company ? [['Purchase Invoice', 'company', '=', company] as FrappeFilter] : []),
                ],
                fields: ['name', 'outstanding_amount'],
                limit_page_length: 5000,
            }),
        ])

        const criticalFailures = [
            totalReceivables,
            totalPayables,
            pendingSales,
            pendingPurchases,
            overdueSales,
            overduePurchases,
        ].filter((result) => result.status === 'rejected') as PromiseRejectedResult[]

        if (criticalFailures.length > 0) {
            const firstReason = criticalFailures[0].reason
            const message = firstReason instanceof Error ? firstReason.message : 'Failed to load dashboard data'
            throw new Error(message)
        }

        const safeVal = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
            result.status === 'fulfilled' ? result.value : fallback

        // Fetch YTD revenue & expense from the root Income / Expense group accounts
        let revenue_ytd = 0
        let expense_ytd = 0
        try {
            const rootAccounts = await frappeClient.getList<{ name: string; root_type: string }>('Account', {
                filters: [
                    ['Account', 'is_group', '=', 1],
                    ['Account', 'parent_account', '=', ''],
                    ...(company ? [['Account', 'company', '=', company] as FrappeFilter] : []),
                ],
                fields: ['name', 'root_type'],
                limit_page_length: 20,
            })
            const incomeRoot = rootAccounts.find(a => a.root_type === 'Income')
            const expenseRoot = rootAccounts.find(a => a.root_type === 'Expense')
            const [incomeResult, expenseResult] = await Promise.allSettled([
                incomeRoot ? this.getAccountBalance(incomeRoot.name, dateToday, company) : Promise.resolve(0),
                expenseRoot ? this.getAccountBalance(expenseRoot.name, dateToday, company) : Promise.resolve(0),
            ])
            revenue_ytd = incomeResult.status === 'fulfilled' ? Math.abs(incomeResult.value) : 0
            expense_ytd = expenseResult.status === 'fulfilled' ? Math.abs(expenseResult.value) : 0
        } catch {
            // non-critical — dashboard still works without YTD
        }

        return {
            total_receivables: safeVal(totalReceivables, 0) as number,
            total_payables: safeVal(totalPayables, 0) as number,
            bank_balances: safeVal(bankBalanceResults, []) as AccountingDashboard['bank_balances'],
            cash_balances: safeVal(cashBalanceResults, []) as AccountingDashboard['cash_balances'],
            revenue_ytd,
            expense_ytd,
            net_profit_ytd: revenue_ytd - expense_ytd,
            pending_sales_invoices: (safeVal(pendingSales, []) as { name: string }[]).length,
            pending_purchase_invoices: (safeVal(pendingPurchases, []) as { name: string }[]).length,
            overdue_sales_invoices: (safeVal(overdueSales, []) as { name: string }[]).length,
            overdue_purchase_invoices: (safeVal(overduePurchases, []) as { name: string }[]).length,
            overdue_sales_amount: (safeVal(overdueSales, []) as { name: string; outstanding_amount?: number }[]).reduce((s, inv) => s + (inv.outstanding_amount ?? 0), 0),
            overdue_purchase_amount: (safeVal(overduePurchases, []) as { name: string; outstanding_amount?: number }[]).reduce((s, inv) => s + (inv.outstanding_amount ?? 0), 0),
        }
    },

    // ─────────────────────── Utility ──────────────────────────────────

    /** Get all companies (shared with purchase-api, duplicated here for convenience). */
    async getCompanies(): Promise<Array<{ name: string; company_name: string; default_currency: string; abbr?: string }>> {
        return frappeClient.getList('Company', {
            fields: ['name', 'company_name', 'default_currency', 'abbr'],
            order_by: 'name asc',
            limit_page_length: 50,
        })
    },

    /** List all payment modes. */
    async getModesOfPayment(): Promise<Array<{ name: string; type: string }>> {
        return frappeClient.getList('Mode of Payment', {
            fields: ['name', 'type'],
            order_by: 'name asc',
            limit_page_length: 100,
        })
    },

    // ─────────────────────── AR Aging ────────────────────────────────

    async getARAgingReport(params: {
        company: string
        report_date?: string
        ageing_based_on?: 'Due Date' | 'Posting Date'
        range1?: number
        range2?: number
        range3?: number
        range4?: number
        customer?: string
    }): Promise<AgingRow[]> {
        const resp = await frappeClient.call<{ result: any[] }>(
            'frappe.desk.query_report.run',
            {
                report_name: 'Accounts Receivable',
                filters: {
                    company: params.company,
                    report_date: params.report_date ?? today(),
                    ageing_based_on: params.ageing_based_on ?? 'Due Date',
                    range1: params.range1 ?? 30,
                    range2: params.range2 ?? 60,
                    range3: params.range3 ?? 90,
                    range4: params.range4 ?? 120,
                    ...(params.customer ? { customer: params.customer } : {}),
                },
            }
        )
        const arRows = resp.message?.result
        if (!Array.isArray(arRows)) return []
        return arRows as AgingRow[]
    },

    // ─────────────────────── AP Aging ────────────────────────────────

    async getAPAgingReport(params: {
        company: string
        report_date?: string
        ageing_based_on?: 'Due Date' | 'Posting Date'
        range1?: number
        range2?: number
        range3?: number
        range4?: number
        supplier?: string
    }): Promise<AgingRow[]> {
        const resp = await frappeClient.call<{ result: any[] }>(
            'frappe.desk.query_report.run',
            {
                report_name: 'Accounts Payable',
                filters: {
                    company: params.company,
                    report_date: params.report_date ?? today(),
                    ageing_based_on: params.ageing_based_on ?? 'Due Date',
                    range1: params.range1 ?? 30,
                    range2: params.range2 ?? 60,
                    range3: params.range3 ?? 90,
                    range4: params.range4 ?? 120,
                    ...(params.supplier ? { supplier: params.supplier } : {}),
                },
            }
        )
        const apRows = resp.message?.result
        if (!Array.isArray(apRows)) return []
        return apRows as AgingRow[]
    },

    // ─────────────────────── Cash Flow Statement ──────────────────────

    async getCashFlowReport(params: {
        company: string
        fiscal_year: string
        period_start_date?: string
        period_end_date?: string
        periodicity?: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'
        cost_center?: string
    }): Promise<CashFlowRow[]> {
        const filters: Record<string, any> = {
            company: params.company,
            fiscal_year: params.fiscal_year,
            period_start_date: params.period_start_date ?? (await this.getFiscalYear(params.company)).year_start_date,
            period_end_date: params.period_end_date ?? today(),
            periodicity: params.periodicity ?? 'Yearly',
        }
        if (params.cost_center) filters.cost_center = params.cost_center
        const resp = await frappeClient.call<{ result: any[]; columns: any[] }>(
            'frappe.desk.query_report.run',
            { report_name: 'Cash Flow', filters }
        )
        const rawRows = resp.message?.result ?? []
        const strip = (s?: string) => s?.replace(/^'+|'+$/g, '').trim() || ''

        return rawRows
            .filter((r: any) => r && Object.keys(r).length > 0)
            .map((r: any): CashFlowRow => {
                const name = strip(r.section_name) || strip(r.account_name) || strip(r.section) || strip(r.account)
                const hasTotal = 'total' in r
                const isSectionHeader = (r.indent === 0 || r.indent === 0.0) && r.parent_section == null && !hasTotal
                const isSubtotal = !('indent' in r) && hasTotal
                return {
                    account: strip(r.section) || strip(r.account) || name,
                    account_name: name,
                    indent: r.indent ?? 0,
                    amount: hasTotal ? (r.total ?? 0) : undefined,
                    is_group: isSectionHeader || isSubtotal,
                }
            })
    },

    // ─────────────────────── VAT Reconciliation ───────────────────────

    async getVATSummary(params: {
        company: string
        from_date?: string
        to_date?: string
    }): Promise<VATSummary> {
        const from = params.from_date ?? (await this.getFiscalYear(params.company)).year_start_date
        const to = params.to_date ?? today()

        // Find VAT accounts for this company (Tax type)
        const vatAccounts = await frappeClient.getList<{ name: string; account_name: string; root_type: string }>('Account', {
            filters: [
                ['Account', 'account_type', '=', 'Tax'],
                ['Account', 'is_group', '=', 0],
                ['Account', 'disabled', '=', 0],
                ['Account', 'company', '=', params.company],
            ],
            fields: ['name', 'account_name', 'root_type'],
            limit_page_length: 50,
        })

        if (!vatAccounts.length) {
            return { output_tax: 0, input_tax: 0, net_payable: 0, output_entries: [], input_entries: [] }
        }

        // Fetch GL entries for all VAT accounts
        const allEntries = await frappeClient.getList<{
            posting_date: string; voucher_no: string; party: string
            debit: number; credit: number; account: string
        }>('GL Entry', {
            filters: [
                ['GL Entry', 'account', 'in', vatAccounts.map(a => a.name)],
                ['GL Entry', 'posting_date', '>=', from],
                ['GL Entry', 'posting_date', '<=', to],
                ['GL Entry', 'is_cancelled', '=', 0],
            ],
            fields: ['posting_date', 'voucher_no', 'party', 'debit', 'credit', 'account'],
            order_by: 'posting_date asc',
            limit_page_length: 2000,
        })

        // Credits = VAT collected from customers (output tax / liability)
        // Debits  = VAT paid to suppliers (input tax / refundable)
        let output_tax = 0, input_tax = 0
        const output_entries: VATSummary['output_entries'] = []
        const input_entries: VATSummary['input_entries'] = []

        for (const e of allEntries) {
            if ((e.credit ?? 0) > 0) {
                output_tax += e.credit
                output_entries.push({ date: e.posting_date, voucher: e.voucher_no, party: e.party ?? '', amount: e.credit })
            }
            if ((e.debit ?? 0) > 0) {
                input_tax += e.debit
                input_entries.push({ date: e.posting_date, voucher: e.voucher_no, party: e.party ?? '', amount: e.debit })
            }
        }

        return { output_tax, input_tax, net_payable: output_tax - input_tax, output_entries, input_entries }
    },

    // ─────────────────────── Bank Reconciliation ──────────────────────

    async getBankAccountSummaries(company?: string): Promise<BankStatement[]> {
        const bankAccounts = await this.getBankCashAccounts(company)
        const banks = bankAccounts.filter(a => a.account_type === 'Bank')
        type BankSummary = { account: string; account_name: string; balance_as_per_books: number }
        const summaries = await Promise.allSettled(banks.map(async acc => ({
            account: acc.name,
            account_name: acc.account_name,
            balance_as_per_books: await this.getAccountBalance(acc.name, today(), company),
        } satisfies BankSummary)))
        return summaries
            .filter((r): r is PromiseFulfilledResult<BankSummary> => r.status === 'fulfilled')
            .map(r => r.value)
    },

    // ─────────────────────── Period Locking ──────────────────────────

    /** Fetch Accounting Periods with their closed_documents child table. */
    async getAccountingPeriods(company?: string): Promise<Array<{
        name: string; period_name: string; start_date: string; end_date: string; company?: string;
        closed_documents: Array<{ document_type: string; closed: number }>
    }>> {
        const filters: FrappeFilter[] = []
        if (company) filters.push(['Accounting Period', 'company', '=', company])
        const list = await frappeClient.getList<{
            name: string; period_name: string; start_date: string; end_date: string; company?: string
        }>('Accounting Period', {
            filters,
            fields: ['name', 'period_name', 'start_date', 'end_date', 'company'],
            order_by: 'start_date desc',
            limit_page_length: 50,
        })
        // Fetch the full doc for each period to get closed_documents child table
        const results = await Promise.allSettled(
            list.map(async (p) => {
                const doc = await frappeClient.get('Accounting Period', p.name)
                return {
                    ...p,
                    closed_documents: (doc.data?.closed_documents ?? []).map((d: any) => ({
                        document_type: d.document_type ?? '',
                        closed: d.closed ?? 0,
                    })),
                }
            })
        )
        return results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map(r => r.value)
    },

    /** Close a period by setting all its closed_documents rows to closed=1. */
    async closePeriod(periodName: string): Promise<void> {
        const doc = await frappeClient.get('Accounting Period', periodName)
        const closedDocs = (doc.data?.closed_documents ?? []).map((d: any) => ({
            ...d,
            closed: 1,
        }))
        await frappeClient.put('Accounting Period', periodName, { closed_documents: closedDocs })
    },

    /** Open a period by setting all its closed_documents rows to closed=0. */
    async openPeriod(periodName: string): Promise<void> {
        const doc = await frappeClient.get('Accounting Period', periodName)
        const closedDocs = (doc.data?.closed_documents ?? []).map((d: any) => ({
            ...d,
            closed: 0,
        }))
        await frappeClient.put('Accounting Period', periodName, { closed_documents: closedDocs })
    },

    /** Search accounts by name fragment (for autocomplete). */
    async searchAccounts(query: string, company?: string): Promise<Account[]> {
        const filters: FrappeFilter[] = [
            ['Account', 'account_name', 'like', `%${query}%`],
            ['Account', 'is_group', '=', 0],
            ['Account', 'disabled', '=', 0],
        ]
        if (company) filters.push(['Account', 'company', '=', company])

        return frappeClient.getList<Account>('Account', {
            filters,
            fields: ['name', 'account_name', 'account_type', 'root_type', 'account_currency', 'company'],
            order_by: 'account_name asc',
            limit_page_length: 20,
        })
    },
}
