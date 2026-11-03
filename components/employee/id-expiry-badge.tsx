'use client'

/**
 * Small Arabic ID/Iqama-expiry badge ("الهوية منتهية" / "تنتهي قريباً" / "سارية").
 * Renders nothing when the date is unset, or when valid and `showValid` is off — so it
 * stays quiet on the list and only flags problems. Reuses getIdExpiryStatus.
 */

import { getIdExpiryStatus } from '@/lib/hr/id-expiry'

export function IdExpiryBadge({
  date,
  showValid = false,
  className = '',
}: {
  date?: string | null
  showValid?: boolean
  className?: string
}) {
  const info = getIdExpiryStatus(date)
  if (info.status === 'none') return null
  if (info.status === 'ok' && !showValid) return null
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${info.badgeClass} ${className}`}
      title={info.daysLeft != null && info.status !== 'ok' ? `${Math.abs(info.daysLeft)} ${info.status === 'expired' ? 'يوم مضى' : 'يوم متبقٍ'}` : undefined}
    >
      {info.labelAr}
    </span>
  )
}
