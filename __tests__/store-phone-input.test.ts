/**
 * isValidIntlPhone must mirror base_meena.real_estate.aqar_public_api._normalize_intake_phone:
 * same 8 countries, same national-part rules — a value the input accepts must never be
 * rejected by the backend (and vice versa).
 */
import { isValidIntlPhone, PHONE_COUNTRIES } from '@/components/store/phone-input'

describe('isValidIntlPhone', () => {
  const valid = [
    '+966512345678', // KSA
    '+971501234567', // UAE
    '+97336123456', // Bahrain
    '+96551234567', // Kuwait
    '+96891234567', // Oman
    '+97433123456', // Qatar
    '+201012345678', // Egypt
    '+962790123456', // Jordan
    '+966 51 234 5678', // spaces tolerated
  ]
  const invalid = [
    '', '+', 'abc',
    '0512345678', // bare local — the input normalizes this itself; raw value is not E.164
    '+9664123456', // KSA must start with 5
    '+96651234', // too short
    '+9665123456789', // too long
    '+15551234567', // US — not an offered country
    '+96612345678a', // trailing junk
  ]

  it.each(valid)('accepts %s', (v) => expect(isValidIntlPhone(v)).toBe(true))
  it.each(invalid)('rejects %s', (v) => expect(isValidIntlPhone(v)).toBe(false))

  it('offers exactly the 8 agreed countries', () => {
    expect(PHONE_COUNTRIES.map((c) => c.iso).sort()).toEqual(
      ['AE', 'BH', 'EG', 'JO', 'KW', 'OM', 'QA', 'SA'],
    )
  })

  it('has no dial code that prefixes another (splitValue relies on first-match)', () => {
    const dials = PHONE_COUNTRIES.map((c) => c.dial)
    for (const a of dials) {
      for (const b of dials) {
        if (a !== b) expect(b.startsWith(a)).toBe(false)
      }
    }
  })
})
