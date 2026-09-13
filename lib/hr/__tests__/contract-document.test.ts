/**
 * Guards the bilingual layout of the generated employment contract: each clause must
 * put the Arabic body in `.ar`, the English body in `.en`, and nothing but the two
 * titles in the heading. A mismatch between `clause()`'s parameter order and its call
 * sites silently swaps these, which typechecking alone does not stop
 * (next.config.mjs sets `ignoreBuildErrors`).
 */
import { buildContractHtml, type ContractDocData } from '../contract-document'

const DATA: ContractDocData = {
  companyName: 'شركة القرعاوي',
  companyCR: '1010101010',
  companyAddress: 'الرياض',
  employeeName: 'محمد أحمد',
  nationality: 'سعودي',
  employeeAddress: 'بريدة',
  idNumber: '1234567890',
  designation: 'محاسب',
  startDate: '2026-01-01',
  workLocation: 'المقر الرئيسي',
  workingHours: 8,
  probationMonths: 3,
} as ContractDocData

describe('buildContractHtml', () => {
  const html = buildContractHtml(DATA)

  const clause1 = () => {
    const sections = html.split('<section class="clause">')
    return sections[1] || ''
  }

  it('puts the Arabic clause body in .ar, not the English title', () => {
    const ar = clause1().match(/<div class="ar">([\s\S]*?)<\/div>\s*<div class="en">/)
    expect(ar).not.toBeNull()
    expect(ar![1]).toContain('الطرف الأول')
    expect(ar![1].trim()).not.toBe('Parties')
  })

  it('puts the English clause body in .en', () => {
    const en = clause1().match(/<div class="en">([\s\S]*?)<\/div>\s*<\/section>/)
    expect(en).not.toBeNull()
    expect(en![1]).toContain('First Party')
  })

  it('keeps the clause heading to the two titles only', () => {
    const h3 = clause1().match(/<h3>([\s\S]*?)<\/h3>/)
    expect(h3).not.toBeNull()
    expect(h3![1]).toContain('أطراف العقد')
    expect(h3![1]).toContain('Parties')
    // The body must not have leaked into the heading.
    expect(h3![1]).not.toContain('الطرف الأول')
  })

  it('renders the mandatory clauses', () => {
    // 15 clause() call sites, two of which are conditional on optional-clause flags.
    expect(html.split('<section class="clause">').length - 1).toBeGreaterThanOrEqual(13)
  })
})
