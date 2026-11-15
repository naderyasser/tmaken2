/**
 * «/m» self-service: رواتبي (own Salary Slips) + طلباتي (own requests).
 *
 * Requests reuse the desktop hub's endpoints (lib/requests-api →
 * base_meena.hr_requests.approvals_api: get_my_requests / create_request /
 * cancel_request). Payslips use two own-data-only endpoints in
 * base_meena.mobile_attendance.tamken_app (get_my_payslips / get_my_payslip),
 * which resolve the employee from the session and take no employee argument.
 */
import { frappeClient } from '@/lib/api-client'
import { requestsApi, type FlowRow } from '@/lib/requests-api'
import { AR_MONTHS, mcall } from '@/lib/m/api'

// ── payslips ────────────────────────────────────────────────────────────────

export interface PayslipRow {
  name: string
  start_date: string
  end_date: string
  currency?: string | null
  gross_pay: number
  total_deduction: number
  net_pay: number
}

export interface PayslipLine {
  salary_component: string
  amount: number
}

export interface PayslipDetail extends PayslipRow {
  employee_name?: string
  posting_date?: string
  payment_days?: number
  total_working_days?: number
  absent_days?: number
  earnings: PayslipLine[]
  deductions: PayslipLine[]
}

export const payslipsApi = {
  list: async (): Promise<PayslipRow[]> => (await mcall<PayslipRow[]>('get_my_payslips')) || [],
  detail: async (name: string): Promise<PayslipDetail> => mcall<PayslipDetail>('get_my_payslip', { name }),
}

/** "2026-10-01" → "أكتوبر 2026" (month of the slip's period end). */
export function payslipMonthLabel(p: Pick<PayslipRow, 'start_date' | 'end_date'>): string {
  const src = p.end_date || p.start_date
  const [y, m] = src.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return src || '—'
  return `${AR_MONTHS[m - 1]} ${y}`
}

/** Latin digits, 2 decimals, thousands separators; null/NaN → "0.00". */
export function money(n: number | null | undefined): string {
  const v = Number(n)
  return (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── requests ────────────────────────────────────────────────────────────────

export type RequestKind = 'leave' | 'permission' | 'letter' | 'punch'

export const REQUEST_KINDS: { key: RequestKind; label: string }[] = [
  { key: 'leave', label: 'إجازة' },
  { key: 'permission', label: 'استئذان' },
  { key: 'letter', label: 'طلب خطاب' },
  { key: 'punch', label: 'تصحيح بصمة' },
]

export const LETTER_TYPES: { value: string; label: string }[] = [
  { value: 'Salary Certificate', label: 'شهادة راتب' },
  { value: 'Employment Letter', label: 'خطاب تعريف' },
  { value: 'Experience Letter', label: 'شهادة خبرة' },
  { value: 'Bank Letter', label: 'خطاب للبنك' },
  { value: 'Custom', label: 'أخرى' },
]

export type StatusTone = 'wait' | 'ok' | 'no' | 'idle'

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  Pending: { label: 'قيد المراجعة', tone: 'wait' },
  Open: { label: 'قيد المراجعة', tone: 'wait' },
  Approved: { label: 'تمت الموافقة', tone: 'ok' },
  Completed: { label: 'مكتمل', tone: 'ok' },
  Rejected: { label: 'مرفوض', tone: 'no' },
  Cancelled: { label: 'ملغي', tone: 'idle' },
}

export function statusInfo(status: string | undefined | null): { label: string; tone: StatusTone } {
  return STATUS[status || ''] || { label: status || '—', tone: 'idle' }
}

export interface RequestFormValues {
  leave_type?: string
  from_date?: string
  to_date?: string
  description?: string
  permission_date?: string
  from_time?: string
  to_time?: string
  letter_type?: string
  purpose?: string
  requested_time?: string
  log_type?: 'IN' | 'OUT'
  reason?: string
}

/** Inclusive calendar days between two YYYY-MM-DD dates (0 when invalid / reversed). */
export function leaveDays(from?: string, to?: string): number {
  if (!from || !to) return 0
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

/** Arabic validation message, or '' when the form is complete. */
export function validateRequest(kind: RequestKind, v: RequestFormValues): string {
  if (kind === 'leave') {
    if (!v.leave_type) return 'اختر نوع الإجازة'
    if (!v.from_date || !v.to_date) return 'حدد تاريخ البداية والنهاية'
    if (v.to_date < v.from_date) return 'تاريخ النهاية قبل البداية'
  } else if (kind === 'permission') {
    if (!v.permission_date) return 'حدد تاريخ الاستئذان'
    if (!v.from_time || !v.to_time) return 'حدد وقت البداية والنهاية'
    if (v.to_time <= v.from_time) return 'وقت النهاية يجب أن يكون بعد البداية'
  } else if (kind === 'letter') {
    if (!v.letter_type) return 'اختر نوع الخطاب'
  } else if (kind === 'punch') {
    if (!v.requested_time) return 'حدد وقت البصمة المطلوب تصحيحها'
    if (!(v.reason || '').trim()) return 'اكتب سبب التصحيح'
  }
  return ''
}

/** Backend payload (keys as read by approvals_api._create_target). Only this kind's fields. */
export function buildPayload(kind: RequestKind, v: RequestFormValues): Record<string, any> {
  const text = (s?: string) => (s || '').trim() || undefined
  switch (kind) {
    case 'leave':
      return { leave_type: v.leave_type, from_date: v.from_date, to_date: v.to_date, description: text(v.description) }
    case 'permission':
      return { permission_date: v.permission_date, from_time: v.from_time, to_time: v.to_time, reason: text(v.reason) }
    case 'letter':
      return { letter_type: v.letter_type, purpose: text(v.purpose) }
    case 'punch':
      return {
        correction_type: 'Missing Punch',
        requested_time: (v.requested_time || '').replace('T', ' '),
        log_type: v.log_type || 'IN',
        reason: text(v.reason),
      }
  }
}

export interface LeaveBalance {
  leave_type: string
  allocated: number
  used: number
  balance: number
}

export const requestsSelf = {
  list: (): Promise<FlowRow[]> => requestsApi.myRequests(),
  create: (kind: RequestKind, employee: string, v: RequestFormValues) =>
    requestsApi.create(kind, employee, buildPayload(kind, v)),
  cancel: (flow: string) => requestsApi.cancel(flow),
  detail: (flow: string) => requestsApi.detail(flow),
  /** Own leave balances (backend asserts the caller may act for this employee). */
  async balances(employee: string): Promise<LeaveBalance[]> {
    const r: any = await frappeClient.call('base_meena.api.leave_summary.get_employee_leave', { employee })
    return (r?.message?.balances as LeaveBalance[]) || []
  },
  async leaveTypes(): Promise<string[]> {
    const rows: any[] = await frappeClient.getList('Leave Type', { fields: ['name'], limit_page_length: 100 })
    return (rows || []).map((r) => r.name)
  },
}
