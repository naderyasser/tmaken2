/**
 * Earned Wage Access (راتبي المرن / EWA) API. Thin typed wrappers over the
 * self-contained backend endpoints (base_meena.ewa.ewa_api.*). Data-only —
 * UI lives in components/me/ewa-card.tsx + components/me/ewa-approvals-card.tsx.
 *
 * The low-level frappeClient.call returns the `message` payload; unwrap() peels it.
 */
import { frappeClient } from '@/lib/api-client'

const M = 'base_meena.ewa.ewa_api'

function unwrap<T>(resp: any): T {
  return (resp?.message ?? resp?.data) as T
}

export type EwaStatus = 'Pending' | 'Approved' | 'Rejected' | 'Disbursed' | 'Cancelled'

/** Feature disabled for the caller's company. */
export interface EwaBalanceDisabled {
  enabled: false
}

/** Earned-balance + eligibility snapshot (all numbers already rounded server-side). */
export interface EwaBalanceEnabled {
  enabled: true
  currency: string
  daily_rate: number
  present_days: number
  gross_earned: number
  cap_percent: number
  cap_amount: number
  outstanding: number
  available: number
  min_amount: number
  requests_used: number
  max_requests: number
  in_blackout: boolean
  tenure_ok: boolean
}

export type EwaBalance = EwaBalanceDisabled | EwaBalanceEnabled

export interface EwaRequestResult {
  name: string
  status: EwaStatus
  amount: number
  auto_approved: boolean
}

export interface EwaActionResult {
  name: string
  status: EwaStatus
}

export interface EwaRequestRow {
  name: string
  amount: number
  status: EwaStatus
  requested_on: string
  payroll_date?: string | null
  reject_reason?: string | null
}

export interface EwaPendingApproval {
  name: string
  employee: string
  employee_name: string
  branch?: string | null
  amount: number
  requested_on: string
  earned_balance_snapshot: number
}

export const ewaApi = {
  /** Earned balance + eligibility snapshot for the logged-in employee. */
  async getMyBalance(): Promise<EwaBalance> {
    return unwrap<EwaBalance>(await frappeClient.call(`${M}.get_my_earned_balance`))
  },
  /** Create an EWA request (may throw a bilingual message if the amount is invalid). */
  async requestEwa(amount: number): Promise<EwaRequestResult> {
    return unwrap<EwaRequestResult>(await frappeClient.call(`${M}.request_ewa`, { amount }))
  },
  /** Approve (and disburse) a pending request — HR or the requester's direct manager. */
  async approveEwa(name: string): Promise<EwaActionResult> {
    return unwrap<EwaActionResult>(await frappeClient.call(`${M}.approve_ewa`, { name }))
  },
  /** Reject a pending request with an optional reason. */
  async rejectEwa(name: string, reason?: string): Promise<EwaActionResult> {
    return unwrap<EwaActionResult>(await frappeClient.call(`${M}.reject_ewa`, { name, reason }))
  },
  /** Cancel a pending request (owning employee only). */
  async cancelEwa(name: string): Promise<EwaActionResult> {
    return unwrap<EwaActionResult>(await frappeClient.call(`${M}.cancel_ewa`, { name }))
  },
  /** The logged-in employee's recent EWA requests. */
  async getMyRequests(limit = 20): Promise<EwaRequestRow[]> {
    return unwrap<EwaRequestRow[]>(await frappeClient.call(`${M}.get_my_ewa_requests`, { limit })) || []
  },
  /** Pending requests the caller may act on ([] if not an approver / none). */
  async getPendingApprovals(): Promise<EwaPendingApproval[]> {
    return unwrap<EwaPendingApproval[]>(await frappeClient.call(`${M}.get_ewa_pending_approvals`)) || []
  },
}
