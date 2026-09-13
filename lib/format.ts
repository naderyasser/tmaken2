/**
 * تمكين HR — canonical display formatters (ONE source for the whole HR app).
 *
 * Locked decisions:
 *  - Currency: Saudi Riyal, thousands separators, LATIN numerals → "200,000 ر.س".
 *  - Dates: Hijri (Umm al-Qura — the official Saudi calendar) FIRST, Gregorian
 *    alongside; Arabic month names with LATIN numerals + هـ / م labels.
 *
 * DISPLAY/CONVERSION ONLY — these never feed business logic. Storage stays
 * Gregorian; the penalty/leave/payroll engines read the stored Gregorian value,
 * never this output. Built on native Intl (no deps).
 *
 * Use these app-wide instead of re-implementing per screen, so two screens can
 * never disagree about the same day's Hijri date.
 */

const HIJRI_LOCALE = 'ar-SA-u-ca-islamic-umalqura-nu-latn'
const GREG_LOCALE = 'ar-SA-u-ca-gregory-nu-latn'

function asDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Active UI locale. Mirrors `Language` from lib/i18n. */
export type AppLocale = 'ar' | 'en'

/**
 * Localized currency symbols. The number is ALWAYS Latin with thousands
 * separators (locked decision); only the symbol follows the locale.
 * Add a new currency here once and the whole app supports it — e.g. EGP.
 */
const CURRENCY_DISPLAY: Record<string, { ar: string; en: string }> = {
  SAR: { ar: 'ر.س', en: 'SAR' },
  EGP: { ar: 'ج.م', en: 'EGP' },
}

export interface CurrencyOptions {
  locale?: AppLocale
  /** ISO currency code (e.g. 'SAR', 'EGP'). Unknown codes render as-is. */
  currency?: string
  decimals?: number
}

/**
 * Canonical currency formatter for the WHOLE app — one source so two screens can
 * never disagree. Latin numerals + thousands separators always; the symbol
 * follows the active locale and currency:
 *   ar → "200,000 ر.س"      ·      en → "SAR 200,000"
 *   ar (EGP) → "200,000 ج.م" ·      en (EGP) → "EGP 200,000"
 * Unknown currency codes fall back to the raw code as the symbol.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  { locale = 'ar', currency = 'SAR', decimals = 0 }: CurrencyOptions = {},
): string {
  if (amount === null || amount === undefined || amount === '') return ''
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n)) return ''
  const num = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
  const code = (currency || 'SAR').toUpperCase()
  const sym = (CURRENCY_DISPLAY[code] ?? { ar: code, en: code })[locale]
  // Arabic reads symbol-after; English reads code-before.
  return locale === 'ar' ? `${num} ${sym}` : `${sym} ${num}`
}

/**
 * "200,000 ر.س" — Arabic-locked Saudi Riyal. Preserved for the HR app's locked
 * Arabic/Hijri identity; delegates to formatCurrency so the formatting logic
 * lives in exactly one place.
 */
export function formatSAR(amount: number | string | null | undefined, decimals = 0): string {
  return formatCurrency(amount, { locale: 'ar', currency: 'SAR', decimals })
}

/** "200,000" — Latin digits, thousands separators (no currency). */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-US').format(n)
}

/** Hijri (Umm al-Qura), Arabic months + Latin numerals + هـ — e.g. "15 محرم 1448 هـ". */
export function hijriDate(value: string | Date | null | undefined): string {
  const d = asDate(value)
  if (!d) return ''
  const s = new Intl.DateTimeFormat(HIJRI_LOCALE, { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
  return /هـ/.test(s) ? s : `${s} هـ`
}

/** Gregorian, Arabic months + Latin numerals + م — e.g. "22 يونيو 2026 م". */
export function gregorianDate(value: string | Date | null | undefined): string {
  const d = asDate(value)
  if (!d) return ''
  const s = new Intl.DateTimeFormat(GREG_LOCALE, { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
  return /\sم$/.test(s) ? s : `${s} م`
}

/** Hijri-first dual display — "15 محرم 1448 هـ · 22 يونيو 2026 م". */
export function dualDate(value: string | Date | null | undefined): string {
  const d = asDate(value)
  if (!d) return ''
  return `${hijriDate(d)} · ${gregorianDate(d)}`
}

/** Compact Hijri for tight cells — "15/01/1448 هـ". */
export function hijriShort(value: string | Date | null | undefined): string {
  const d = asDate(value)
  if (!d) return ''
  return `${new Intl.DateTimeFormat(HIJRI_LOCALE, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)} هـ`
}

/** Time only, Latin numerals — "08:30". */
export function formatTime(value: string | Date | null | undefined): string {
  const d = asDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

export interface DateDisplayOptions {
  /** Render the Umm al-Qura (Hijri) date instead of Gregorian. */
  hijri?: boolean
  /** Append the Hijri date alongside the Gregorian one. */
  withHijri?: boolean
}

/**
 * Short numeric date for tables/cells/inputs — **dd/mm/yyyy**, Latin numerals,
 * day-first (never the en-US mm/dd/yyyy that native <input type="date"> shows on
 * en-US machines). Tolerant of ISO datetime strings / null.
 *   default      → "22/06/2026"
 *   { hijri }    → "06/12/1447 هـ"
 *   { withHijri }→ "22/06/2026 · 06/12/1447 هـ"
 */
export function formatDateShort(
  value: string | Date | null | undefined,
  { hijri = false, withHijri = false }: DateDisplayOptions = {},
): string {
  const d = asDate(value)
  if (!d) return ''
  if (hijri) return hijriShort(d)
  const greg = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d) // dd/mm/yyyy, Latin numerals
  return withHijri ? `${greg} · ${hijriShort(d)}` : greg
}
