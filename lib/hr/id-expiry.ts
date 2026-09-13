/**
 * National ID / Iqama expiry awareness — single source of truth.
 *
 * Computes whether an employee's `custom_id_expiry_date` (one field covering both the
 * Saudi National ID and the resident Iqama) is expired, expiring soon, valid, or unset.
 * Pure & display-only; storage stays Gregorian. Reused by the employee form, the list
 * badge, the detail view — and structured so a future renewal-alert job can reuse the
 * same thresholds/logic.
 */

export type IdExpiryStatus = 'expired' | 'expiring' | 'ok' | 'none'

export interface IdExpiryInfo {
  status: IdExpiryStatus
  daysLeft: number | null // days until expiry (negative = past), null when unset/invalid
  labelAr: string
  labelEn: string
  badgeClass: string // .theme-hr status colours for the badge
}

/** ID counts as "expiring soon" within this many days of its expiry date. */
export const ID_EXPIRY_WINDOW_DAYS = 60

export function getIdExpiryStatus(
  dateStr: string | null | undefined,
  now: Date = new Date()
): IdExpiryInfo {
  const none: IdExpiryInfo = { status: 'none', daysLeft: null, labelAr: '', labelEn: '', badgeClass: '' }
  if (!dateStr) return none
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr)
  if (Number.isNaN(d.getTime())) return none

  // Compare calendar days only (ignore time-of-day).
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const daysLeft = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  if (daysLeft < 0) {
    return { status: 'expired', daysLeft, labelAr: 'الهوية منتهية', labelEn: 'ID expired', badgeClass: 'bg-red-50 text-red-700 border-red-200' }
  }
  if (daysLeft <= ID_EXPIRY_WINDOW_DAYS) {
    return { status: 'expiring', daysLeft, labelAr: 'تنتهي قريباً', labelEn: 'Expiring soon', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  return { status: 'ok', daysLeft, labelAr: 'سارية', labelEn: 'Valid', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}
