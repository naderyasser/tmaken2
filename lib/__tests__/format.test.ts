import { formatCurrency, formatSAR, formatDateShort } from '@/lib/format'

describe('formatCurrency', () => {
  it('Arabic SAR: number then symbol, Latin digits', () => {
    expect(formatCurrency(200000, { locale: 'ar', currency: 'SAR' })).toBe('200,000 ر.س')
  })

  it('English SAR: code before number', () => {
    expect(formatCurrency(200000, { locale: 'en', currency: 'SAR' })).toBe('SAR 200,000')
  })

  it('supports EGP in both locales', () => {
    expect(formatCurrency(1500, { locale: 'ar', currency: 'EGP' })).toBe('1,500 ج.م')
    expect(formatCurrency(1500, { locale: 'en', currency: 'EGP' })).toBe('EGP 1,500')
  })

  it('falls back to the raw code for unknown currencies', () => {
    expect(formatCurrency(10, { locale: 'en', currency: 'QAR' })).toBe('QAR 10')
  })

  it('honours decimals', () => {
    expect(formatCurrency(1234.5, { locale: 'en', currency: 'SAR', decimals: 2 })).toBe('SAR 1,234.50')
  })

  it('defaults to Arabic SAR with no options', () => {
    expect(formatCurrency(50)).toBe('50 ر.س')
  })

  it('returns empty string for null / blank / non-finite', () => {
    expect(formatCurrency(null)).toBe('')
    expect(formatCurrency(undefined)).toBe('')
    expect(formatCurrency('')).toBe('')
    expect(formatCurrency('abc')).toBe('')
  })
})

describe('formatSAR (Arabic-locked back-compat)', () => {
  it('keeps the legacy "200,000 ر.س" output', () => {
    expect(formatSAR(200000)).toBe('200,000 ر.س')
  })
})

describe('formatDateShort', () => {
  // Use Date objects (local) for exact assertions so the result is timezone-stable.
  it('renders dd/mm/yyyy (day-first, Latin numerals)', () => {
    expect(formatDateShort(new Date(2026, 5, 22))).toBe('22/06/2026')
  })

  it('tolerates a datetime value', () => {
    expect(formatDateShort(new Date(2026, 5, 22, 13, 45))).toBe('22/06/2026')
  })

  it('parses an ISO date string into dd/mm/yyyy shape', () => {
    expect(formatDateShort('2026-06-22')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('returns empty for blank / invalid', () => {
    expect(formatDateShort('')).toBe('')
    expect(formatDateShort(null)).toBe('')
    expect(formatDateShort('not-a-date')).toBe('')
  })
})
