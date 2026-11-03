/**
 * Shared types + small helpers for «تفاصيل مجموعة المواقع» (Apex M6,
 * `hr/locations-group-details`). Backed by `base_meena.api.hr_location_groups`
 * — see that file for exact shapes.
 */

export type TransactionTab = 'leaves' | 'permissions' | 'punches'

export const TABS: { id: TransactionTab; label: string }[] = [
  { id: 'leaves', label: 'الاجازات' },
  { id: 'permissions', label: 'الاذونات' },
  { id: 'punches', label: 'البصمات' },
]

export interface GroupLocation {
  name: string
  location_name: string
  latitude?: number | null
  longitude?: number | null
  custom_radius_m?: number | null
  custom_status?: 'Active' | 'Inactive' | null
}

export interface GroupOverview {
  name: string
  location_name: string
  locations: GroupLocation[]
  employee_count: number
}

export interface GroupEmployee {
  name: string
  employee_name: string
  branch?: string | null
  department?: string | null
  designation?: string | null
}

export interface TransactionRow {
  doctype: 'Leave Application' | 'Permission Request' | 'Employee Checkin'
  name: string
  employee: string
  employee_name?: string | null
  branch?: string | null
  date: string
  date_to?: string | null
  from_time?: string | null
  to_time?: string | null
  type: string
  status: string
  status_label: string
  reason?: string | null
  latitude?: number | null
  longitude?: number | null
  docstatus: number
}

/** Status pill colour per tab — leaves/permissions carry a real Frappe
 *  workflow status, punches carry a punch-source key instead. */
export function statusBadgeClass(tab: TransactionTab, statusKey: string): string {
  if (tab === 'punches') {
    return {
      device: 'bg-[var(--apex-blue-light)]/10 text-[var(--apex-blue)]',
      gps: 'bg-emerald-100 text-emerald-700',
      manual: 'bg-slate-100 text-slate-600',
    }[statusKey] || 'bg-slate-100 text-slate-600'
  }
  return {
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Cancelled: 'bg-slate-200 text-slate-500',
    Open: 'bg-slate-100 text-slate-600',
    Draft: 'bg-slate-100 text-slate-600',
    Pending: 'bg-amber-100 text-amber-700',
  }[statusKey] || 'bg-slate-100 text-slate-600'
}

/** Options for the «الحالة» filter — differ by tab since punches has no
 *  workflow status of its own (see hr_location_groups.list_group_transactions). */
export function statusOptionsFor(tab: TransactionTab): { value: string; label: string }[] {
  if (tab === 'punches') {
    return [
      { value: 'device', label: 'بصمة جهاز' },
      { value: 'gps', label: 'بصمة موقع (GPS)' },
      { value: 'manual', label: 'يدوي' },
    ]
  }
  return [
    { value: 'Open', label: 'مفتوح' },
    { value: 'Approved', label: 'معتمد' },
    { value: 'Rejected', label: 'مرفوض' },
    { value: 'Cancelled', label: 'ملغي' },
  ]
}

/** First day of the current month, ISO — the default «من تاريخ». */
export function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
