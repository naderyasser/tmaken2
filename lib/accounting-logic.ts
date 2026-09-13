export const JOURNAL_BALANCE_TOLERANCE = 0.001
export const BALANCE_SHEET_TOLERANCE = 0.01

export interface JournalLineInput {
    account?: string | null
    debit?: number | string | null
    credit?: number | string | null
}

export interface EffectiveJournalLine {
    index: number
    account: string
    debit: number
    credit: number
}

export interface JournalValidationResult {
    effectiveLines: EffectiveJournalLine[]
    totalDebit: number
    totalCredit: number
    difference: number
    balanced: boolean
    hasValueLines: boolean
    allHaveAccounts: boolean
    allSingleSided: boolean
    isValid: boolean
}

export interface BalanceSheetEquationInput {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    currentPeriodEarnings: number
    tolerance?: number
}

export interface BalanceSheetEquationResult {
    rightSide: number
    difference: number
    isBalanced: boolean
}

export function toAmount(value: number | string | null | undefined): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0
    }

    if (typeof value === 'string') {
        const parsed = parseFloat(value)
        return Number.isFinite(parsed) ? parsed : 0
    }

    return 0
}

export function computeCurrentPeriodEarnings(totalIncome: number, totalExpense: number): number {
    return totalIncome - totalExpense
}

export function validateBalanceSheetEquation(input: BalanceSheetEquationInput): BalanceSheetEquationResult {
    const tolerance = input.tolerance ?? BALANCE_SHEET_TOLERANCE
    const rightSide = input.totalLiabilities + input.totalEquity + input.currentPeriodEarnings
    const difference = Math.abs(input.totalAssets - rightSide)

    return {
        rightSide,
        difference,
        isBalanced: difference < tolerance,
    }
}

export function validateJournalEntryLines(
    lines: JournalLineInput[],
    tolerance: number = JOURNAL_BALANCE_TOLERANCE
): JournalValidationResult {
    const effectiveLines: EffectiveJournalLine[] = lines
        .map((line, index) => ({
            index,
            account: (line.account ?? '').trim(),
            debit: toAmount(line.debit),
            credit: toAmount(line.credit),
        }))
        .filter((line) => line.debit > 0 || line.credit > 0)

    const totalDebit = effectiveLines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = effectiveLines.reduce((sum, line) => sum + line.credit, 0)
    const difference = Math.abs(totalDebit - totalCredit)

    const hasValueLines = effectiveLines.length > 0
    const allHaveAccounts = effectiveLines.every((line) => line.account !== '')
    const allSingleSided = effectiveLines.every((line) =>
        (line.debit > 0 || line.credit > 0) && !(line.debit > 0 && line.credit > 0)
    )
    const balanced = difference < tolerance
    const isValid = hasValueLines && allHaveAccounts && allSingleSided && balanced

    return {
        effectiveLines,
        totalDebit,
        totalCredit,
        difference,
        balanced,
        hasValueLines,
        allHaveAccounts,
        allSingleSided,
        isValid,
    }
}
