/**
 * QA round: data-correctness guards for the sales vertical.
 * #3 — default report range must be chronological (from < to, 30-day window).
 * #4 — all formatters must emit WESTERN digits + Gregorian dates in ar/ur.
 */
import {
  defaultReportDateRange,
  formatSAR,
  formatNumber,
  formatDateShort,
  formatTime,
  displayLocale,
  visitTypeLabel,
} from '@/lib/sales-format'

const ARABIC_INDIC = /[٠-٩۰-۹]/

describe('defaultReportDateRange (#3)', () => {
  it('from is strictly before to, 30 days apart', () => {
    const { from, to } = defaultReportDateRange(new Date('2026-07-10T12:00:00'))
    expect(from).toBe('2026-06-10')
    expect(to).toBe('2026-07-10')
    expect(from < to).toBe(true)
  })

  it('uses local time, not UTC (no day flip just after midnight)', () => {
    // 00:30 local — toISOString() would report the previous day in +03:00
    const { to } = defaultReportDateRange(new Date(2026, 6, 10, 0, 30, 0))
    expect(to).toBe('2026-07-10')
  })

  it('handles month/year boundaries', () => {
    const { from, to } = defaultReportDateRange(new Date(2026, 0, 15, 9, 0, 0))
    expect(to).toBe('2026-01-15')
    expect(from).toBe('2025-12-16')
    expect(from < to).toBe(true)
  })
})

describe('numeral standardization (#4)', () => {
  it('formatSAR never emits Arabic-Indic digits', () => {
    for (const lang of ['ar', 'en', 'ur']) {
      const out = formatSAR(1234.5, lang)
      expect(out).not.toMatch(ARABIC_INDIC)
      expect(out).toContain('1,234.50')
    }
  })

  it('formatNumber never emits Arabic-Indic digits', () => {
    expect(formatNumber(98765, 'ar')).not.toMatch(ARABIC_INDIC)
    expect(formatNumber(98765, 'ur')).not.toMatch(ARABIC_INDIC)
  })

  it('formatSAR in Arabic carries the SAR symbol', () => {
    expect(formatSAR(10, 'ar')).toMatch(/ر\.س|SAR/)
  })

  it('dates are Gregorian with Western digits in Arabic (not Hijri ar-SA)', () => {
    const out = formatDateShort('2026-07-09', 'ar')
    expect(out).not.toMatch(ARABIC_INDIC)
    expect(out).toContain('09/07/2026') // Hijri would be 1447/1448
  })

  it('rtl dates are wrapped in a directional isolate so bidi cannot reorder segments', () => {
    expect(formatDateShort('2026-07-09', 'ar')).toBe('⁦09/07/2026⁩')
    expect(formatDateShort('2026-07-09', 'ur')).toBe('⁦09/07/2026⁩')
    expect(formatDateShort('2026-07-09', 'en')).toBe('07/09/2026') // en is already LTR
  })

  it('formatDateShort accepts frappe datetimes ("YYYY-MM-DD HH:mm:ss")', () => {
    expect(formatDateShort('2026-07-09 00:00:00', 'en')).toContain('2026')
    expect(formatDateShort('', 'en')).toBe('')
    expect(formatDateShort(null, 'ar')).toBe('')
  })

  it('formatTime handles bare time fields and datetimes without Arabic-Indic digits', () => {
    expect(formatTime('14:30:00', 'ar')).not.toMatch(ARABIC_INDIC)
    expect(formatTime('2026-07-09 14:30:00', 'ar')).not.toMatch(ARABIC_INDIC)
    expect(formatTime(null, 'ar')).toBe('')
  })

  it('displayLocale pins latn digits for rtl languages', () => {
    expect(displayLocale('ar')).toContain('nu-latn')
    expect(displayLocale('ur')).toContain('nu-latn')
    expect(new Date('2026-07-09').toLocaleDateString(displayLocale('ar'))).not.toMatch(ARABIC_INDIC)
  })
})

describe('visitTypeLabel (#5)', () => {
  const t = (key: string) => (key === 'sr.admin.dialogs.sv_vt_followup' ? 'متابعة' : key)

  it('translates known values through registered keys', () => {
    expect(visitTypeLabel(t, 'Follow-up')).toBe('متابعة')
  })

  it('falls back to the raw value for unknown types or unregistered keys', () => {
    expect(visitTypeLabel(t, 'Sales Order')).toBe('Sales Order') // key unregistered in this fake t
    expect(visitTypeLabel(t, 'Some Custom Type')).toBe('Some Custom Type')
    expect(visitTypeLabel(t, null)).toBe('')
  })
})
