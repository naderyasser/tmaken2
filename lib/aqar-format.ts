/**
 * Locale-aware formatting for the Real Estate module (Arabic-first).
 * - Numerals: Arabic-Indic in AR, Western in EN (one place, per the design direction).
 * - Prices: Saudi Riyal, e.g. "٢٨٬٠٠٠ ريال / سنويًا".
 * - Dates: Hijri + Gregorian dual display (Hijri first in AR), native Intl — no deps.
 */

type Lang = 'ar' | 'en'

const periodAr: Record<string, string> = {
  Sale: '',
  Rent: '/ سنويًا',
  'Daily Rent': '/ يوميًا',
}
const periodEn: Record<string, string> = {
  Sale: '',
  Rent: '/ yearly',
  'Daily Rent': '/ daily',
}

// Brand rule: Western digits + tabular-nums for ALL stats/prices/tables (both locales).
// Arabic-Indic numerals are reserved for Hijri dates and prose (see hijriDate/timeAgo).
export function formatNumber(value: number | string | null | undefined, _lang: Lang = 'ar'): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatPrice(
  amount: number | string | null | undefined,
  lang: Lang = 'ar',
  listingType?: string,
): string {
  if (amount === null || amount === undefined || amount === '') return lang === 'ar' ? 'السعر عند الطلب' : 'Price on request'
  const num = formatNumber(amount, lang)
  if (lang === 'ar') {
    const suffix = listingType ? ` ${periodAr[listingType] ?? ''}`.trimEnd() : ''
    return `${num} ريال${suffix}`
  }
  const suffix = listingType ? ` ${periodEn[listingType] ?? ''}`.trimEnd() : ''
  return `${num} SAR${suffix}`
}

// Western → Arabic-Indic digits (٠١٢…). PRESENTATION only — values stay numeric for sorting/parsing.
const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
export function toArabicIndic(s: string): string {
  return s.replace(/[0-9]/g, (d) => ARABIC_INDIC[+d])
}
/** Same as formatPrice but with Arabic-Indic numerals — for showcase spots (e.g. the listing hero). */
export function formatPriceIndic(amount: number | string | null | undefined, listingType?: string): string {
  return toArabicIndic(formatPrice(amount, 'ar', listingType))
}

function safeDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function gregorianDate(value: string | Date | null | undefined, lang: Lang = 'ar'): string {
  const d = safeDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', calendar: 'gregory',
  }).format(d)
}

export function hijriDate(value: string | Date | null | undefined, lang: Lang = 'ar'): string {
  const d = safeDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic' : 'en-US-u-ca-islamic', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(d)
}

/** Dual display — Hijri first in AR, Gregorian first in EN. */
export function dualDate(value: string | Date | null | undefined, lang: Lang = 'ar'): string {
  const d = safeDate(value)
  if (!d) return ''
  const h = hijriDate(d, lang)
  const g = gregorianDate(d, lang)
  return lang === 'ar' ? `${h} — ${g}` : `${g} — ${h}`
}

export function timeAgo(value: string | Date | null | undefined, lang: Lang = 'ar'): string {
  const d = safeDate(value)
  if (!d) return ''
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}
