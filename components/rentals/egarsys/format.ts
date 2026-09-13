// Ported from egarsys src/lib/format.ts. Only the display helpers the dashboard
// and contracts section use; Hijri formatting delegates to the scoped ICU
// Umm al-Qura engine (./engine/hijri) so dual dates match egarsys 1:1.

import { gregorianToHijri, hijriMonthName } from './engine/hijri'

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

export function toArabicNumerals(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[+d])
}

export function formatSAR(amount: number | null | undefined): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function normalizeDateStr(dateStr: string): string {
  // Prisma serializes DateTime as full ISO strings ("2024-01-15T00:00:00.000Z");
  // the Frappe mirror sends naive "YYYY-MM-DD HH:MM:SS". Strip the time portion
  // (either separator) so splitting by '-' always yields [YYYY, MM, DD].
  const s = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  return s.includes(' ') ? s.split(' ')[0] : s
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const parts = normalizeDateStr(String(dateStr)).split('-')
  if (parts.length !== 3) return '—'
  const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-SA')
}

export function formatNumber(amount: number): string {
  return amount.toLocaleString('ar-SA')
}

const ARABIC_ORDINALS = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس',
  'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر',
]

/** "القسط الأول" … "القسط الثاني عشر", falling back to "القسط 13" beyond the list. */
export function installmentLabelAr(no: number | null | undefined): string {
  if (!no || no < 1) return 'القسط —'
  return no <= ARABIC_ORDINALS.length ? `القسط ${ARABIC_ORDINALS[no - 1]}` : `القسط ${no}`
}

/** Human Arabic duration from a day count: "٥ أيام" / "أسبوعين" / "٣ أشهر" / "سنة وشهرين". */
export function formatDurationAr(days: number): string {
  const d = Math.max(0, Math.floor(days))
  if (d < 1) return 'أقل من يوم'
  if (d < 7) return d === 1 ? 'يوم' : d === 2 ? 'يومين' : `${d} أيام`
  if (d < 30) {
    const w = Math.floor(d / 7)
    return w === 1 ? 'أسبوع' : w === 2 ? 'أسبوعين' : `${w} أسابيع`
  }
  if (d < 365) {
    const m = Math.floor(d / 30)
    return m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m <= 10 ? `${m} أشهر` : `${m} شهرًا`
  }
  const y = Math.floor(d / 365)
  const remMonths = Math.floor((d % 365) / 30)
  const yStr = y === 1 ? 'سنة' : y === 2 ? 'سنتين' : `${y} سنوات`
  if (!remMonths) return yStr
  return `${yStr} و${remMonths === 1 ? 'شهر' : remMonths === 2 ? 'شهرين' : `${remMonths} أشهر`}`
}

/** Whole days elapsed since the given date (ISO string), or null when unparsable. */
export function daysSince(dateStr: string | null | undefined, now: Date = new Date()): number | null {
  if (!dateStr) return null
  const d = new Date(String(dateStr).replace(' ', 'T'))
  if (isNaN(d.getTime())) return null
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000)
}

// ─── Hijri calendar formatting ───

const gregorianFormatter = new Intl.DateTimeFormat('ar-SA', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/** e.g. "٢٣ ذو القعدة ١٤٤٧ هـ" */
export function formatHijri(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const parts = normalizeDateStr(String(dateStr)).split('-')
  const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
  const h = gregorianToHijri(d)
  if (h.year === 0) return '—'
  return `${toArabicNumerals(h.day)} ${hijriMonthName(h.month)} ${toArabicNumerals(h.year)} هـ`
}

/** Compact single-line dual display: "٢٣ ذو القعدة ١٤٤٧ هـ (١٠ مايو ٢٠٢٦ م)" */
export function formatDateDualCompact(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const parts = normalizeDateStr(String(dateStr)).split('-')
  const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
  if (isNaN(d.getTime())) return '—'
  const h = gregorianToHijri(d)
  const hijriStr = h.year === 0 ? '—' : `${toArabicNumerals(h.day)} ${hijriMonthName(h.month)} ${toArabicNumerals(h.year)} هـ`
  return `${hijriStr} (${gregorianFormatter.format(d)} م)`
}
