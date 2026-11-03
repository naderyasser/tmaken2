/**
 * Commission API Client
 * Connects to base_meena.commission.commission_api endpoints
 *
 * Scoping is enforced on the server, not here: every list endpoint pins a
 * non-manager caller to their own Sales Person, so the rep PWA and the back
 * office call the same methods and the rep simply gets less back.
 */

import { frappeClient } from './api-client'

// ==================== Types ====================

export type CommissionBasis = 'On Invoice' | 'On Collection'
export type CalculationType = 'Flat Percentage' | 'By Item Group'
export type BaseAmountType = 'Net Amount (excluding VAT)' | 'Grand Total (including VAT)'
export type EntryStatus = 'Pending' | 'Approved' | 'Paid' | 'Cancelled'
export type PayoutStatus = 'Draft' | 'Paid' | 'Cancelled'

export interface CommissionItemGroupRate {
    item_group: string
    commission_percent: number
}

export interface CommissionRule {
    name?: string
    rule_name: string
    enabled: number
    company: string
    sales_person?: string | null
    sales_person_name?: string
    valid_from: string
    valid_upto?: string | null
    commission_basis: CommissionBasis
    calculation_type: CalculationType
    commission_percent?: number
    default_percent?: number
    item_group_rates?: CommissionItemGroupRate[]
    base_amount_type: BaseAmountType
    max_discount_percent?: number
    min_invoice_amount?: number
    notes?: string
}

export interface CommissionEntry {
    name: string
    sales_person: string
    sales_person_name?: string
    company: string
    status: EntryStatus
    entry_type: 'Accrual' | 'Reversal'
    posting_date: string
    period?: string
    reference_doctype?: string
    reference_name?: string
    sales_invoice?: string
    customer?: string
    customer_name?: string
    commission_rule?: string
    base_amount: number
    allocated_percentage?: number
    commission_percent: number
    commission_amount: number
    payout?: string | null
    remarks?: string
}

export interface CommissionSummaryRow {
    sales_person: string
    sales_person_name?: string
    entries: number
    pending: number
    approved: number
    paid: number
    total: number
    base_total: number
}

export interface CommissionSummary {
    rows: CommissionSummaryRow[]
    totals: {
        pending: number
        approved: number
        paid: number
        total: number
        base_total: number
        entries: number
    }
    from_date: string
    to_date: string
}

export interface CommissionPayout {
    name: string
    sales_person: string
    sales_person_name?: string
    company: string
    status: PayoutStatus
    from_date: string
    to_date: string
    total_amount: number
    entry_count: number
    payment_method?: string
    reference_no?: string
    paid_on?: string
    remarks?: string
}

export interface CommissionSettings {
    enabled: boolean
    has_rules: boolean
    is_manager: boolean
    sales_person: string | null
}

export interface MyCommission {
    sales_person: string
    from_date: string
    to_date: string
    pending: number
    approved: number
    paid: number
    total: number
    base_total: number
    entries: CommissionEntry[]
    payouts: CommissionPayout[]
}

export interface DateRange {
    from_date?: string
    to_date?: string
}

// ==================== API ====================

const BASE = 'base_meena.commission.commission_api'

const EMPTY_SUMMARY: CommissionSummary = {
    rows: [],
    totals: { pending: 0, approved: 0, paid: 0, total: 0, base_total: 0, entries: 0 },
    from_date: '',
    to_date: '',
}

export const commissionApi = {
    // ── Settings ──

    async getSettings(): Promise<CommissionSettings> {
        const resp = await frappeClient.call<CommissionSettings>(`${BASE}.get_commission_settings`, {})
        return (
            resp.message ||
            resp.data || { enabled: false, has_rules: false, is_manager: false, sales_person: null }
        )
    },

    // ── Rules ──

    async getRules(company?: string): Promise<CommissionRule[]> {
        const resp = await frappeClient.call<CommissionRule[]>(`${BASE}.get_commission_rules`, { company })
        return resp.message || resp.data || []
    },

    async saveRule(rule: Partial<CommissionRule>): Promise<{ name: string; rule_name: string }> {
        const resp = await frappeClient.call<{ name: string; rule_name: string }>(
            `${BASE}.save_commission_rule`,
            { data: JSON.stringify(rule) }
        )
        return resp.message || resp.data || { name: '', rule_name: '' }
    },

    /**
     * Rules that have already paid something are disabled rather than deleted —
     * the server decides which, and reports back which it did.
     */
    async deleteRule(name: string): Promise<{ disabled: boolean; deleted: boolean; entries: number }> {
        const resp = await frappeClient.call<{ disabled: boolean; deleted: boolean; entries: number }>(
            `${BASE}.delete_commission_rule`,
            { name }
        )
        return resp.message || resp.data || { disabled: false, deleted: false, entries: 0 }
    },

    // ── Entries ──

    async getEntries(
        options: DateRange & { sales_person?: string; status?: EntryStatus; company?: string; limit?: number } = {}
    ): Promise<CommissionEntry[]> {
        const resp = await frappeClient.call<CommissionEntry[]>(`${BASE}.get_commission_entries`, options)
        return resp.message || resp.data || []
    },

    async getSummary(options: DateRange & { company?: string } = {}): Promise<CommissionSummary> {
        const resp = await frappeClient.call<CommissionSummary>(`${BASE}.get_commission_summary`, options)
        return resp.message || resp.data || EMPTY_SUMMARY
    },

    async getMyCommission(options: DateRange = {}): Promise<MyCommission | null> {
        const resp = await frappeClient.call<MyCommission>(`${BASE}.get_my_commission`, options)
        return resp.message || resp.data || null
    },

    async approve(entries: string[]): Promise<{ approved: string[]; skipped: string[] }> {
        const resp = await frappeClient.call<{ approved: string[]; skipped: string[] }>(
            `${BASE}.approve_commission_entries`,
            { entries: JSON.stringify(entries) }
        )
        return resp.message || resp.data || { approved: [], skipped: [] }
    },

    async reject(entries: string[], reason?: string): Promise<{ rejected: string[]; skipped: string[] }> {
        const resp = await frappeClient.call<{ rejected: string[]; skipped: string[] }>(
            `${BASE}.reject_commission_entries`,
            { entries: JSON.stringify(entries), reason }
        )
        return resp.message || resp.data || { rejected: [], skipped: [] }
    },

    async recalculateInvoice(invoice: string): Promise<{ removed: string[]; created: string[] }> {
        const resp = await frappeClient.call<{ removed: string[]; created: string[] }>(
            `${BASE}.recalculate_invoice_commission`,
            { invoice }
        )
        return resp.message || resp.data || { removed: [], created: [] }
    },

    // ── Payouts ──

    async getPayouts(options: { sales_person?: string; status?: PayoutStatus; limit?: number } = {}): Promise<CommissionPayout[]> {
        const resp = await frappeClient.call<CommissionPayout[]>(`${BASE}.get_payouts`, options)
        return resp.message || resp.data || []
    },

    async getPayoutEntries(payout: string): Promise<CommissionEntry[]> {
        const resp = await frappeClient.call<CommissionEntry[]>(`${BASE}.get_payout_entries`, { payout })
        return resp.message || resp.data || []
    },

    async createPayout(data: {
        sales_person: string
        from_date: string
        to_date: string
        payment_method?: string
        reference_no?: string
        remarks?: string
    }): Promise<{ name: string; total_amount: number; entry_count: number }> {
        const resp = await frappeClient.call<{ name: string; total_amount: number; entry_count: number }>(
            `${BASE}.create_payout`,
            data
        )
        return resp.message || resp.data || { name: '', total_amount: 0, entry_count: 0 }
    },

    async markPayoutPaid(payout: string, reference_no?: string): Promise<{ name: string; status: string; entries: number }> {
        const resp = await frappeClient.call<{ name: string; status: string; entries: number }>(
            `${BASE}.mark_payout_paid`,
            { payout, reference_no }
        )
        return resp.message || resp.data || { name: '', status: '', entries: 0 }
    },

    async cancelPayout(payout: string, reason?: string): Promise<{ name: string; status: string; entries: number }> {
        const resp = await frappeClient.call<{ name: string; status: string; entries: number }>(
            `${BASE}.cancel_payout`,
            { payout, reason }
        )
        return resp.message || resp.data || { name: '', status: '', entries: 0 }
    },
}
