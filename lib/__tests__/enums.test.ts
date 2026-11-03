import { translateEnum } from '@/lib/enums'

describe('translateEnum', () => {
  it('translates a territory stored in Arabic into the English UI (no leak)', () => {
    expect(translateEnum('territory', 'باقي أنحاء العالم', 'en')).toBe('Rest of the World')
    expect(translateEnum('territory', 'باقي أنحاء العالم', 'ar')).toBe('باقي أنحاء العالم')
  })

  it('translates the English canonical territory too', () => {
    expect(translateEnum('territory', 'Rest Of The World', 'ar')).toBe('باقي أنحاء العالم')
    expect(translateEnum('territory', 'Rest Of The World', 'en')).toBe('Rest of the World')
  })

  it('translates proposal statuses', () => {
    expect(translateEnum('proposalStatus', 'Accepted', 'ar')).toBe('مقبول')
    expect(translateEnum('proposalStatus', 'Accepted', 'en')).toBe('Accepted')
  })

  it('translates invoice statuses', () => {
    expect(translateEnum('invoiceStatus', 'Paid', 'en')).toBe('Paid')
    expect(translateEnum('invoiceStatus', 'Overdue', 'ar')).toBe('متأخرة')
    expect(translateEnum('invoiceStatus', 'Partly Paid', 'ar')).toBe('مدفوعة جزئياً')
  })

  it('falls back to the raw value for unknown members', () => {
    expect(translateEnum('territory', 'Jeddah Region', 'en')).toBe('Jeddah Region')
  })

  it('returns empty string for blank / nullish', () => {
    expect(translateEnum('territory', '', 'en')).toBe('')
    expect(translateEnum('territory', null, 'en')).toBe('')
    expect(translateEnum('territory', undefined, 'en')).toBe('')
  })
})
