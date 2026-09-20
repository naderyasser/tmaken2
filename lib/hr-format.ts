/**
 * تمكين HR — canonical Latin-digit date/time/number formatters for the HR shell.
 *
 * Apex renders every date as DD/MM/YYYY with LATIN numerals — never Hijri,
 * never an `ar-SA`/`ar-EG` locale (both can silently switch to Arabic-Indic
 * digits or the Islamic calendar depending on the runtime's ICU data). The
 * topbar fiscal period must read exactly "01/01/2026 - 31/12/2026", the same
 * as the Apex reference.
 *
 * This is the ONE place that produces that string for the HR shell so no
 * screen can drift back to a locale-dependent format. Built on `Intl` /
 * manual padding only — no `ar-*` locale tag is ever passed to `Intl`.
 *
 * Accepts a `Date`, a plain date (`'YYYY-MM-DD'`), a Frappe/ISO datetime
 * (`'YYYY-MM-DD HH:mm:ss'` or with `T`), or — for `fmtTime` only — a bare
 * time string (`'HH:mm:ss'` / `'HH:mm'`).
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Parses the inputs above into a local `Date`, or `null` if unparsable. */
function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  // Plain 'YYYY-MM-DD' — build from parts so the local day never shifts by
  // one when `new Date('YYYY-MM-DD')` is parsed as UTC midnight.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }

  // 'YYYY-MM-DD HH:mm:ss' (Frappe's wire format) — swap the space for 'T' so
  // the browser parses it as local time instead of rejecting it outright.
  const normalized = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `'YYYY-MM-DD'` | `Date` | ISO/Frappe datetime → `'DD/MM/YYYY'`. */
export function fmtDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** `Date` | ISO/Frappe datetime → `'DD/MM/YYYY HH:mm'`. */
export function fmtDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return `${fmtDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** `Date` | ISO/Frappe datetime | `'HH:mm:ss'` | `'HH:mm'` → `'HH:mm'`. */
export function fmtTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    const bare = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim())
    if (bare) return `${pad2(Number(bare[1]))}:${bare[2]}`
  }
  const d = toDate(value)
  if (!d) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Latin-digit number with thousands separators — never an `ar-*` locale. */
export function fmtNumber(value: number | string | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}
