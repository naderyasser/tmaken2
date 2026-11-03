'use client'

/**
 * Small GOSI registration-status badge ("GOSI registered" / "Not registered" / "Check
 * error"). Reads the persisted Employee.custom_gosi_registration_status — it does NOT
 * call the API, so it is safe to render per-row in lists (the live check is the explicit
 * single-employee action on the detail card). Hides when the status is unset, or
 * "Unknown"/not-checked unless `showUnknown` is set — so it stays quiet on the list.
 */

import { getGosiStatusInfo } from '@/lib/hr/gosi-status'
import { useI18n } from '@/lib/i18n'

export function GosiStatusBadge({
  status,
  showUnknown = false,
  className = '',
}: {
  status?: string | null
  showUnknown?: boolean
  className?: string
}) {
  const { isRTL } = useI18n()
  const info = getGosiStatusInfo(status)
  if (info.key === 'none') return null
  if (info.key === 'Unknown' && !showUnknown) return null
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${info.badgeClass} ${className}`}
    >
      {isRTL ? info.labelAr : info.labelEn}
    </span>
  )
}
