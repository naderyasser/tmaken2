import {
    computeCurrentPeriodEarnings,
    toAmount,
    validateBalanceSheetEquation,
    validateJournalEntryLines,
} from '../accounting-logic'

describe('accounting-logic', () => {
    describe('toAmount', () => {
        it('parses numbers and numeric strings', () => {
            expect(toAmount(10)).toBe(10)
            expect(toAmount('15.75')).toBeCloseTo(15.75, 5)
        })

        it('returns 0 for invalid values', () => {
            expect(toAmount('abc')).toBe(0)
            expect(toAmount(undefined)).toBe(0)
            expect(toAmount(null)).toBe(0)
        })
    })

    describe('validateJournalEntryLines', () => {
        it('accepts balanced and valid double-entry lines', () => {
            const result = validateJournalEntryLines([
                { account: 'Cash - ACME', debit: '100', credit: '' },
                { account: 'Sales - ACME', debit: '', credit: '100' },
            ])

            expect(result.hasValueLines).toBe(true)
            expect(result.allHaveAccounts).toBe(true)
            expect(result.allSingleSided).toBe(true)
            expect(result.balanced).toBe(true)
            expect(result.totalDebit).toBe(100)
            expect(result.totalCredit).toBe(100)
            expect(result.isValid).toBe(true)
        })

        it('rejects unbalanced entries', () => {
            const result = validateJournalEntryLines([
                { account: 'Cash - ACME', debit: 100, credit: 0 },
                { account: 'Sales - ACME', debit: 0, credit: 90 },
            ])

            expect(result.balanced).toBe(false)
            expect(result.difference).toBeCloseTo(10, 5)
            expect(result.isValid).toBe(false)
        })

        it('rejects entries with missing accounts on value lines', () => {
            const result = validateJournalEntryLines([
                { account: '', debit: 50, credit: 0 },
                { account: 'Revenue - ACME', debit: 0, credit: 50 },
            ])

            expect(result.allHaveAccounts).toBe(false)
            expect(result.isValid).toBe(false)
        })

        it('rejects entries when a line contains both debit and credit values', () => {
            const result = validateJournalEntryLines([
                { account: 'Cash - ACME', debit: 40, credit: 10 },
                { account: 'Revenue - ACME', debit: 0, credit: 30 },
            ])

            expect(result.allSingleSided).toBe(false)
            expect(result.isValid).toBe(false)
        })

        it('rejects entries without any valued lines', () => {
            const result = validateJournalEntryLines([
                { account: 'Cash - ACME', debit: 0, credit: 0 },
                { account: 'Revenue - ACME', debit: '', credit: '' },
            ])

            expect(result.hasValueLines).toBe(false)
            expect(result.isValid).toBe(false)
        })

        it('respects balance tolerance', () => {
            const result = validateJournalEntryLines([
                { account: 'Cash - ACME', debit: 100.0004, credit: 0 },
                { account: 'Revenue - ACME', debit: 0, credit: 100 },
            ])

            expect(result.balanced).toBe(true)
            expect(result.isValid).toBe(true)
        })
    })

    describe('balance sheet equation', () => {
        it('computes current period earnings', () => {
            expect(computeCurrentPeriodEarnings(1200, 350)).toBe(850)
        })

        it('validates balanced equation: Assets = Liabilities + Equity + Current Period Earnings', () => {
            const currentPeriodEarnings = computeCurrentPeriodEarnings(1200, 400)
            const result = validateBalanceSheetEquation({
                totalAssets: 2000,
                totalLiabilities: 700,
                totalEquity: 500,
                currentPeriodEarnings,
            })

            expect(result.rightSide).toBe(2000)
            expect(result.difference).toBeCloseTo(0, 5)
            expect(result.isBalanced).toBe(true)
        })

        it('flags unbalanced equation', () => {
            const result = validateBalanceSheetEquation({
                totalAssets: 2000,
                totalLiabilities: 700,
                totalEquity: 500,
                currentPeriodEarnings: 600,
            })

            expect(result.rightSide).toBe(1800)
            expect(result.isBalanced).toBe(false)
            expect(result.difference).toBeCloseTo(200, 5)
        })

        it('accepts small difference inside tolerance', () => {
            const result = validateBalanceSheetEquation({
                totalAssets: 1000,
                totalLiabilities: 499.997,
                totalEquity: 300,
                currentPeriodEarnings: 200,
                tolerance: 0.01,
            })

            expect(result.isBalanced).toBe(true)
        })
    })
})
