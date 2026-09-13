/**
 * Shared display formatting for the sales vertical (admin + rep PWA).
 *
 * One rule app-wide: WESTERN (Latin) digits in every language, Gregorian
 * calendar dates. `ar-SA` must never be passed to Intl directly — it renders
 * Arabic-Indic digits (٠١٢) and, for dates, the Hijri calendar, which is what
 * caused mixed numeral styles across pages.
 */

export type SalesLang = 'ar' | 'en' | 'ur' | string

function numberLocale(lang: SalesLang): string {
  // -u-nu-latn pins Western digits; plain 'ar' (not ar-SA) keeps Gregorian.
  if (lang === 'ar') return 'ar-u-nu-latn'
  if (lang === 'ur') return 'ur-PK-u-nu-latn'
  return 'en-US'
}

/**
 * Locale string for direct Intl / toLocale* calls in components.
 * Same guarantees as the formatters: Western digits, Gregorian calendar.
 */
export function displayLocale(lang: SalesLang): string {
  return numberLocale(lang)
}

/** Plain number with localized grouping but Western digits. */
export function formatNumber(value: number | null | undefined, lang: SalesLang, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(numberLocale(lang), options).format(Number(value) || 0)
}

/** SAR currency, Western digits: "١٢٣" never — ar "123.00 ر.س."، en "SAR 123.00". */
export function formatSAR(value: number | null | undefined, lang: SalesLang): string {
  return new Intl.NumberFormat(numberLocale(lang), {
    style: 'currency', currency: 'SAR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

/**
 * Short Gregorian date (ar/ur "dd/mm/yyyy", en "mm/dd/yyyy"). Empty-safe.
 * Built manually instead of Intl: with Latin digits (strong LTR) inside an
 * RTL paragraph the ICU output reorders visually ("092026/07/"), so the date
 * is wrapped in an LRI…PDI directional isolate that bidi cannot scramble.
 */
export function formatDateShort(date: string | Date | null | undefined, lang: SalesLang): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date.includes('T') || date.includes(' ') ? date.replace(' ', 'T') : date + 'T00:00:00') : date
  if (isNaN(d.getTime())) return typeof date === 'string' ? date : ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const dd = pad(d.getDate())
  const mm = pad(d.getMonth() + 1)
  const yyyy = d.getFullYear()
  if (lang === 'en') return `${mm}/${dd}/${yyyy}`
  return `⁦${dd}/${mm}/${yyyy}⁩`
}

/** Time of day, Western digits (e.g. "11:41 م" / "11:41 PM"). Empty-safe. */
export function formatTime(datetime: string | Date | null | undefined, lang: SalesLang): string {
  if (!datetime) return ''
  let d: Date
  if (typeof datetime === 'string') {
    // bare "HH:mm:ss" (frappe Time fields) as well as full datetimes
    d = /^\d{2}:\d{2}/.test(datetime) ? new Date(`1970-01-01T${datetime}`) : new Date(datetime.replace(' ', 'T'))
  } else d = datetime
  if (isNaN(d.getTime())) return typeof datetime === 'string' ? datetime : ''
  return new Intl.DateTimeFormat(numberLocale(lang), { hour: '2-digit', minute: '2-digit' }).format(d)
}

/** Date + time on one line. */
export function formatDateTime(datetime: string | Date | null | undefined, lang: SalesLang): string {
  if (!datetime) return ''
  const date = formatDateShort(datetime, lang)
  const time = formatTime(datetime, lang)
  return time ? `${date} ${time}` : date
}

/**
 * Default reports range: last 30 days up to today, in SITE-LOCAL time
 * (never toISOString — that flips the day between midnight and ~3am Riyadh).
 */
export function defaultReportDateRange(now: Date = new Date()): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const from = new Date(now)
  from.setDate(from.getDate() - 30)
  return { from: iso(from), to: iso(now) }
}

// ---- Visit type display labels (values stay English in the database) ------

const VISIT_TYPE_KEYS: Record<string, string> = {
  'Follow-up': 'sr.admin.dialogs.sv_vt_followup',
  'Sales Order': 'sr.admin.dialogs.sv_vt_sales_order',
  'Stock Check': 'sr.admin.dialogs.sv_vt_stock_check',
  'Product Return': 'sr.admin.dialogs.sv_vt_product_return',
  'No Order - Visit Only': 'sr.admin.dialogs.sv_vt_visit_only',
  'Regular Visit': 'sr.admin.dialogs.sv_vt_regular_visit',
  'New Customer': 'sr.admin.dialogs.sv_vt_new_customer',
  'Urgent': 'sr.admin.dialogs.sv_vt_urgent',
}

/** Localized label for a visit_type value; falls back to the raw value. */
export function visitTypeLabel(t: (key: string) => string, value?: string | null): string {
  if (!value) return ''
  const key = VISIT_TYPE_KEYS[value]
  if (!key) return value
  const v = t(key)
  return v === key ? value : v
}
