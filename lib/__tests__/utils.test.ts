/**
 * lib/utils.test.ts — Tests for utility helpers
 * HIGH-1 regression: localToday() must return the local calendar date, not UTC.
 */

import { localToday } from '../utils'

describe('localToday', () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    it('returns the local calendar date, not the UTC date', () => {
        // Freeze the clock to a moment that is still Apr 16 locally (UTC+3)
        // but already Apr 15 in UTC: 2026-04-16T02:00:00+03:00 = 2026-04-15T23:00:00Z
        // A UTC-based today() returns '2026-04-15'; the correct local today is '2026-04-16'.
        const localMidnightCrossingUTC = new Date('2026-04-15T23:00:00Z') // 02:00 local in UTC+3
        jest.useFakeTimers({ now: localMidnightCrossingUTC })

        expect(localToday()).toBe('2026-04-16')
    })

    it('returns the correct date in the same-day UTC window (no ambiguity)', () => {
        // 2026-04-16T10:00:00Z — both UTC and local (UTC+3) agree it is Apr 16
        jest.useFakeTimers({ now: new Date('2026-04-16T10:00:00Z') })

        expect(localToday()).toBe('2026-04-16')
    })

    it('returns a valid ISO date string format (YYYY-MM-DD)', () => {
        jest.useFakeTimers({ now: new Date('2026-04-01T12:00:00Z') })
        const result = localToday()
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
})
