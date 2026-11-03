/**
 * Unit tests for attendance report utility functions.
 * Tests: time sorting, Arabic localization, hours calculation with break subtraction.
 */

import {
  parseTime,
  sortCheckinsChronologically,
  formatTimeArabic,
  calculateWorkHoursFromPair,
  calculateWorkHoursFromCheckins,
  hasMissingOutPunch,
  calculateLiveHours,
  formatGenderArabic,
  formatWorkingHours,
  getArabicDayName,
  formatDateArabic,
  type CheckinDetail,
} from '@/lib/attendance-utils'

// ─── Helpers to build test CheckinDetail objects ───

const IN = (time: string): CheckinDetail => ({
  name: 'test-in',
  time,
  log_type: 'IN',
  latitude: null,
  longitude: null,
  photo_image: null,
  checkin_method: null,
  biometric_verified: 0,
  biometric_type: null,
})

const OUT = (time: string): CheckinDetail => ({
  name: 'test-out',
  time,
  log_type: 'OUT',
  latitude: null,
  longitude: null,
  photo_image: null,
  checkin_method: null,
  biometric_verified: 0,
  biometric_type: null,
})

describe('parseTime', () => {
  it('parses space-separated datetime', () => {
    const ts = parseTime('2026-05-05 08:00:00')
    expect(ts).toBeGreaterThan(0)
    expect(isNaN(ts)).toBe(false)
  })

  it('parses T-separated datetime', () => {
    const ts = parseTime('2026-05-05T14:30:00')
    expect(ts).toBeGreaterThan(0)
    expect(isNaN(ts)).toBe(false)
  })

  it('returns NaN for null', () => {
    expect(isNaN(parseTime(null))).toBe(true)
  })

  it('returns NaN for garbage string', () => {
    expect(isNaN(parseTime('not-a-date'))).toBe(true)
  })
})

describe('sortCheckinsChronologically', () => {
  it('sorts AM before PM within the same day', () => {
    const punches: CheckinDetail[] = [
      IN('2026-05-05 15:58:00'),   // 3:58 PM — should come AFTER 2:03 AM
      OUT('2026-05-05 02:03:00'),  // 2:03 AM
    ]
    const sorted = sortCheckinsChronologically(punches)
    expect(sorted[0].time).toBe('2026-05-05 02:03:00')  // AM first
    expect(sorted[1].time).toBe('2026-05-05 15:58:00')  // PM second
  })

  it('sorts multiple IN/OUT pairs chronologically', () => {
    const punches: CheckinDetail[] = [
      OUT('2026-05-05 16:00:00'),
      IN('2026-05-05 08:00:00'),
      OUT('2026-05-05 12:00:00'),
      IN('2026-05-05 12:30:00'),
    ]
    const sorted = sortCheckinsChronologically(punches)
    const times = sorted.map(c => c.time)
    expect(times).toEqual([
      '2026-05-05 08:00:00',
      '2026-05-05 12:00:00',
      '2026-05-05 12:30:00',
      '2026-05-05 16:00:00',
    ])
  })

  it('handles empty array', () => {
    expect(sortCheckinsChronologically([])).toEqual([])
  })

  it('filters out null-time entries', () => {
    const punches: CheckinDetail[] = [
      { ...IN('2026-05-05 08:00:00'), time: null },
      IN('2026-05-05 09:00:00'),
    ]
    const sorted = sortCheckinsChronologically(punches)
    expect(sorted.length).toBe(1)
    expect(sorted[0].time).toBe('2026-05-05 09:00:00')
  })
})

describe('formatTimeArabic', () => {
  it('formats AM correctly with ص', () => {
    expect(formatTimeArabic('2026-05-05 08:02:00')).toBe('8:02 ص')
  })

  it('formats PM correctly with م', () => {
    expect(formatTimeArabic('2026-05-05 16:07:00')).toBe('4:07 م')
  })

  it('formats noon (12:00) as PM', () => {
    expect(formatTimeArabic('2026-05-05 12:00:00')).toBe('12:00 م')
  })

  it('formats midnight (00:00) as AM', () => {
    expect(formatTimeArabic('2026-05-05 00:30:00')).toBe('12:30 ص')
  })

  it('returns — for null', () => {
    expect(formatTimeArabic(null)).toBe('—')
  })

  it('handles T-separated datetime', () => {
    expect(formatTimeArabic('2026-05-05T14:15:00')).toBe('2:15 م')
  })

  it('pads single-digit minutes with zero', () => {
    expect(formatTimeArabic('2026-05-05 08:05:00')).toBe('8:05 ص')
  })
})

describe('formatGenderArabic', () => {
  it('translates Male → ذكر', () => {
    expect(formatGenderArabic('Male')).toBe('ذكر')
  })
  it('translates Female → أنثى', () => {
    expect(formatGenderArabic('Female')).toBe('أنثى')
  })
  it('returns empty for null', () => {
    expect(formatGenderArabic(null)).toBe('')
  })
})

describe('formatWorkingHours', () => {
  it('formats 8 hours exactly', () => {
    expect(formatWorkingHours(8)).toBe('8h 0m')
  })
  it('formats 8.5 hours', () => {
    expect(formatWorkingHours(8.5)).toBe('8h 30m')
  })
  it('formats 7.75 hours', () => {
    expect(formatWorkingHours(7.75)).toBe('7h 45m')
  })
})

describe('calculateWorkHoursFromPair', () => {
  it('calculates simple 8-hour day', () => {
    expect(calculateWorkHoursFromPair(
      '2026-05-05 08:00:00',
      '2026-05-05 16:00:00'
    )).toBe(8)
  })

  it('returns 0 for missing in_time', () => {
    expect(calculateWorkHoursFromPair(null, '2026-05-05 16:00:00')).toBe(0)
  })

  it('returns 0 for missing out_time', () => {
    expect(calculateWorkHoursFromPair('2026-05-05 08:00:00', null)).toBe(0)
  })

  it('returns 0 for negative duration (checkout before checkin)', () => {
    expect(calculateWorkHoursFromPair(
      '2026-05-05 16:00:00',
      '2026-05-05 08:00:00'
    )).toBe(0)
  })
})

describe('calculateWorkHoursFromCheckins', () => {
  it('calculates total from multiple IN→OUT pairs, subtracting breaks', () => {
    const punches: CheckinDetail[] = [
      IN('2026-05-05 08:00:00'),
      OUT('2026-05-05 12:00:00'),   // break starts
      IN('2026-05-05 12:30:00'),     // break ends (30 min break excluded)
      OUT('2026-05-05 16:00:00'),
    ]
    // 08:00→12:00 = 4h  +  12:30→16:00 = 3.5h  = 7.5h
    expect(calculateWorkHoursFromCheckins(punches)).toBe(7.5)
  })

  it('returns 0 for empty array', () => {
    expect(calculateWorkHoursFromCheckins([])).toBe(0)
  })

  it('handles missing OUT (unpaired IN is ignored, no NaN)', () => {
    const punches: CheckinDetail[] = [
      IN('2026-05-05 08:00:00'),
      // No OUT — unpaired IN should be ignored, return 0
    ]
    const result = calculateWorkHoursFromCheckins(punches)
    expect(result).toBe(0)
    expect(isNaN(result)).toBe(false)
  })

  it('handles OUT without preceding IN (ignored)', () => {
    const punches: CheckinDetail[] = [
      OUT('2026-05-05 12:00:00'),  // no preceding IN
      IN('2026-05-05 12:30:00'),
      OUT('2026-05-05 16:00:00'),
    ]
    expect(calculateWorkHoursFromCheckins(punches)).toBe(3.5)
  })

  it('handles consecutive IN punches (uses last IN)', () => {
    const punches: CheckinDetail[] = [
      IN('2026-05-05 08:00:00'),
      IN('2026-05-05 08:02:00'),   // duplicate IN — last one wins
      OUT('2026-05-05 16:00:00'),
    ]
    // 08:02→16:00 = 7h 58m ≈ 7.97h
    const result = calculateWorkHoursFromCheckins(punches)
    expect(result).toBeCloseTo(7.97, 1)
  })

  it('handles overnight correctly (crosses midnight)', () => {
    const punches: CheckinDetail[] = [
      IN('2026-05-05 22:00:00'),
      OUT('2026-05-06 02:00:00'),  // 4 hours
    ]
    expect(calculateWorkHoursFromCheckins(punches)).toBe(4)
  })

  it('excludes NaN-time entries gracefully', () => {
    const punches: CheckinDetail[] = [
      { ...IN('2026-05-05 08:00:00'), time: 'invalid-date' },
      IN('2026-05-05 08:30:00'),
      OUT('2026-05-05 16:30:00'),
    ]
    expect(calculateWorkHoursFromCheckins(punches)).toBe(8)
  })
})

describe('hasMissingOutPunch', () => {
  it('detects missing OUT', () => {
    expect(hasMissingOutPunch([IN('2026-05-05 08:00:00')])).toBe(true)
  })

  it('returns false when both IN and OUT exist', () => {
    expect(hasMissingOutPunch([IN('2026-05-05 08:00:00'), OUT('2026-05-05 16:00:00')])).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(hasMissingOutPunch([])).toBe(false)
  })

  it('returns false when only OUT exists (no IN)', () => {
    expect(hasMissingOutPunch([OUT('2026-05-05 16:00:00')])).toBe(false)
  })
})

describe('calculateLiveHours', () => {
  it('returns positive hours for a time in the past', () => {
    // 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    const result = calculateLiveHours(twoHoursAgo)
    expect(result).toBeGreaterThan(1.9)
    expect(result).toBeLessThan(2.1)
  })

  it('returns 0 for invalid time', () => {
    expect(calculateLiveHours('invalid')).toBe(0)
  })
})

describe('Arabic helpers', () => {
  it('getArabicDayName returns correct day', () => {
    // 2026-05-05 is a Tuesday (الثلاثاء)
    expect(getArabicDayName('2026-05-05')).toBe('الثلاثاء')
  })

  it('formatDateArabic formats as DD/MM/YYYY', () => {
    expect(formatDateArabic('2026-05-05')).toBe('05/05/2026')
    expect(formatDateArabic('2026-01-09')).toBe('09/01/2026')
  })
})
