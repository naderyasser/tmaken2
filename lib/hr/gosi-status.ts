/**
 * GOSI registration-status presentation — single source of truth for the badge/card.
 *
 * Maps the persisted Employee.custom_gosi_registration_status value (Registered /
 * Not Registered / Unknown / Error — placeholder enum pending the official GOSI API
 * spec) to a bilingual label + .theme-hr status colour. Pure & display-only.
 */

export type GosiStatusKey = 'Registered' | 'Not Registered' | 'Unknown' | 'Error' | 'none'

export interface GosiStatusInfo {
  key: GosiStatusKey
  labelAr: string
  labelEn: string
  badgeClass: string
}

export function getGosiStatusInfo(status: string | null | undefined): GosiStatusInfo {
  switch ((status || '').trim()) {
    case 'Registered':
      return { key: 'Registered', labelAr: 'مسجّل في التأمينات', labelEn: 'GOSI registered', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'Not Registered':
      return { key: 'Not Registered', labelAr: 'غير مسجّل في التأمينات', labelEn: 'Not registered', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'Error':
      return { key: 'Error', labelAr: 'خطأ في التحقق', labelEn: 'Check error', badgeClass: 'bg-red-50 text-red-700 border-red-200' }
    case 'Unknown':
      return { key: 'Unknown', labelAr: 'لم يُتحقَّق', labelEn: 'Not checked', badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' }
    default:
      return { key: 'none', labelAr: '', labelEn: '', badgeClass: '' }
  }
}
