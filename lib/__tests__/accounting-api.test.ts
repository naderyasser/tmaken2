/**
 * accounting-api.test.ts — Comprehensive Test Suite
 *
 * Covers all functions in accountingApi with:
 *  - Happy paths
 *  - Edge cases (empty results, undefined fields)
 *  - Error/rejection paths
 *  - Correct frappeClient calls (doctype, filters, fields)
 */

jest.mock('../api-client', () => ({
    frappeClient: {
        getList: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        call: jest.fn(),
    },
}))

import { accountingApi } from '../accounting-api'
import { frappeClient } from '../api-client'

const mockGetList = frappeClient.getList as jest.Mock
const mockGet = frappeClient.get as jest.Mock
const mockPost = frappeClient.post as jest.Mock
const mockPut = frappeClient.put as jest.Mock
const mockDelete = frappeClient.delete as jest.Mock
const mockCall = frappeClient.call as jest.Mock

// ── Factories ────────────────────────────────────────────────────────

const makeAccount = (overrides = {}) => ({
    name: 'ACC-001',
    account_name: 'Test Account',
    company: 'ACME',
    root_type: 'Asset',
    account_type: 'Cash',
    account_currency: 'SAR',
    is_group: 0,
    disabled: 0,
    ...overrides,
})

const makeJE = (overrides = {}) => ({
    name: 'JV-001',
    company: 'ACME',
    posting_date: '2026-04-01',
    voucher_type: 'Journal Entry',
    total_debit: 500,
    total_credit: 500,
    docstatus: 0,
    ...overrides,
})

const makeSI = (overrides = {}) => ({
    name: 'SINV-001',
    customer: 'Customer A',
    company: 'ACME',
    posting_date: '2026-04-01',
    grand_total: 1000,
    outstanding_amount: 1000,
    docstatus: 1,
    ...overrides,
})

const makePE = (overrides = {}) => ({
    name: 'PE-001',
    company: 'ACME',
    payment_type: 'Receive',
    party_type: 'Customer',
    party: 'Customer A',
    posting_date: '2026-04-01',
    paid_amount: 500,
    paid_from: 'CASH-001',
    paid_to: 'REC-001',
    docstatus: 0,
    ...overrides,
})

// ─────────────────────────────────────────────────────────────────────
describe('accountingApi', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    // ══════════════════════════════════════════════
    // Chart of Accounts
    // ══════════════════════════════════════════════

    describe('getAccounts', () => {
        it('returns all active accounts by default', async () => {
            mockGetList.mockResolvedValueOnce([makeAccount()])
            const result = await accountingApi.getAccounts()
            expect(result).toHaveLength(1)
            expect(mockGetList).toHaveBeenCalledWith('Account', expect.objectContaining({
                order_by: 'lft asc',
            }))
        })

        it('passes company filter when provided', async () => {
            mockGetList.mockResolvedValueOnce([makeAccount()])
            await accountingApi.getAccounts({ company: 'ACME' })
            const call = mockGetList.mock.calls[0]
            const filters = call[1].filters as any[]
            expect(filters).toContainEqual(['Account', 'company', '=', 'ACME'])
        })

        it('passes root_type filter', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getAccounts({ root_type: 'Asset' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Account', 'root_type', '=', 'Asset'])
        })

        it('passes account_type filter', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getAccounts({ account_type: 'Bank' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Account', 'account_type', '=', 'Bank'])
        })

        it('passes is_group=true as 1', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getAccounts({ is_group: true })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Account', 'is_group', '=', 1])
        })

        it('passes is_group=false as 0', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getAccounts({ is_group: false })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Account', 'is_group', '=', 0])
        })

        it('returns empty array when no accounts match', async () => {
            mockGetList.mockResolvedValueOnce([])
            expect(await accountingApi.getAccounts()).toEqual([])
        })
    })

    describe('getAccount', () => {
        it('returns the account when found', async () => {
            mockGet.mockResolvedValueOnce({ data: makeAccount() })
            const result = await accountingApi.getAccount('ACC-001')
            expect(result.name).toBe('ACC-001')
            expect(mockGet).toHaveBeenCalledWith('Account', 'ACC-001')
        })

        it('throws when account not found', async () => {
            mockGet.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.getAccount('MISSING')).rejects.toThrow('Account not found')
        })
    })

    describe('createAccount', () => {
        it('creates an Asset account with inferred Balance Sheet report_type', async () => {
            const acc = makeAccount({ root_type: 'Asset', report_type: 'Balance Sheet' })
            mockPost.mockResolvedValueOnce({ data: acc })

            const result = await accountingApi.createAccount({
                account_name: 'Test Account',
                company: 'ACME',
                root_type: 'Asset',
            })

            expect(result.name).toBe('ACC-001')
            expect(mockPost).toHaveBeenCalledWith('Account', expect.objectContaining({
                account_name: 'Test Account',
                company: 'ACME',
                root_type: 'Asset',
                report_type: 'Balance Sheet',
            }))
        })

        it('infers Profit and Loss for Income root_type', async () => {
            mockPost.mockResolvedValueOnce({ data: makeAccount({ root_type: 'Income' }) })
            await accountingApi.createAccount({ account_name: 'Revenue', company: 'ACME', root_type: 'Income' })
            expect(mockPost).toHaveBeenCalledWith('Account', expect.objectContaining({
                report_type: 'Profit and Loss',
            }))
        })

        it('infers Profit and Loss for Expense root_type', async () => {
            mockPost.mockResolvedValueOnce({ data: makeAccount({ root_type: 'Expense' }) })
            await accountingApi.createAccount({ account_name: 'Expenses', company: 'ACME', root_type: 'Expense' })
            expect(mockPost).toHaveBeenCalledWith('Account', expect.objectContaining({
                report_type: 'Profit and Loss',
            }))
        })

        it('sets is_group=1 when is_group:true', async () => {
            mockPost.mockResolvedValueOnce({ data: makeAccount({ is_group: 1 }) })
            await accountingApi.createAccount({ account_name: 'Group', company: 'ACME', root_type: 'Asset', is_group: true })
            expect(mockPost).toHaveBeenCalledWith('Account', expect.objectContaining({ is_group: 1 }))
        })

        it('throws when response has no data', async () => {
            mockPost.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.createAccount({
                account_name: 'X',
                company: 'ACME',
                root_type: 'Asset',
            })).rejects.toThrow('Failed to create Account')
        })
    })

    describe('updateAccount', () => {
        it('updates account_name and disabled', async () => {
            const updated = makeAccount({ account_name: 'Renamed', disabled: 1 })
            mockPut.mockResolvedValueOnce({ data: updated })
            const result = await accountingApi.updateAccount('ACC-001', { account_name: 'Renamed', disabled: true })
            expect(result.account_name).toBe('Renamed')
            expect(mockPut).toHaveBeenCalledWith('Account', 'ACC-001', expect.objectContaining({
                account_name: 'Renamed',
                disabled: 1,
            }))
        })

        it('converts is_group boolean to 0/1', async () => {
            mockPut.mockResolvedValueOnce({ data: makeAccount() })
            await accountingApi.updateAccount('ACC-001', { is_group: false })
            expect(mockPut).toHaveBeenCalledWith('Account', 'ACC-001', expect.objectContaining({ is_group: 0 }))
        })

        it('only sends defined fields (partial update)', async () => {
            mockPut.mockResolvedValueOnce({ data: makeAccount() })
            await accountingApi.updateAccount('ACC-001', { account_name: 'Only Name' })
            const payload = mockPut.mock.calls[0][2]
            expect(payload).toHaveProperty('account_name', 'Only Name')
            expect(payload).not.toHaveProperty('disabled')
            expect(payload).not.toHaveProperty('root_type')
        })

        it('throws when response has no data', async () => {
            mockPut.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.updateAccount('ACC-001', { account_name: 'X' })).rejects.toThrow('Failed to update Account')
        })
    })

    describe('getBankCashAccounts', () => {
        it('returns Bank and Cash accounts', async () => {
            const accounts = [
                makeAccount({ account_type: 'Bank' }),
                makeAccount({ name: 'CASH-001', account_type: 'Cash' }),
            ]
            mockGetList.mockResolvedValueOnce(accounts)
            const result = await accountingApi.getBankCashAccounts('ACME')
            expect(result).toHaveLength(2)
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Account', 'account_type', 'in', ['Bank', 'Cash']])
        })

        it('works without company filter', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getBankCashAccounts()
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            const companyFilter = filters.find((f: any[]) => f[1] === 'company')
            expect(companyFilter).toBeUndefined()
        })
    })

    describe('getControlAccounts', () => {
        it('fetches Receivable accounts', async () => {
            mockGetList.mockResolvedValueOnce([makeAccount({ account_type: 'Receivable' })])
            const result = await accountingApi.getControlAccounts('Receivable', 'ACME')
            expect(result).toHaveLength(1)
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Account', 'account_type', '=', 'Receivable'])
        })

        it('fetches Payable accounts', async () => {
            mockGetList.mockResolvedValueOnce([makeAccount({ account_type: 'Payable' })])
            const result = await accountingApi.getControlAccounts('Payable')
            expect(result).toHaveLength(1)
        })
    })

    // ══════════════════════════════════════════════
    // GL Entries
    // ══════════════════════════════════════════════

    describe('getGLEntries', () => {
        it('returns GL entries with default is_cancelled=0 filter', async () => {
            const entry = { name: 'GLE-001', account: 'CASH-001', posting_date: '2026-04-01', company: 'ACME' }
            mockGetList.mockResolvedValueOnce([entry])
            const result = await accountingApi.getGLEntries()
            expect(result).toHaveLength(1)
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['GL Entry', 'is_cancelled', '=', 0])
        })

        it('filters by company', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getGLEntries({ company: 'ACME' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['GL Entry', 'company', '=', 'ACME'])
        })

        it('filters by date range', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getGLEntries({ from_date: '2026-01-01', to_date: '2026-04-15' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['GL Entry', 'posting_date', '>=', '2026-01-01'])
            expect(filters).toContainEqual(['GL Entry', 'posting_date', '<=', '2026-04-15'])
        })

        it('filters by voucher_type and voucher_no', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getGLEntries({ voucher_type: 'Journal Entry', voucher_no: 'JV-001' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['GL Entry', 'voucher_type', '=', 'Journal Entry'])
            expect(filters).toContainEqual(['GL Entry', 'voucher_no', '=', 'JV-001'])
        })

        it('filters by party_type and party', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getGLEntries({ party_type: 'Customer', party: 'Cust-001' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['GL Entry', 'party_type', '=', 'Customer'])
            expect(filters).toContainEqual(['GL Entry', 'party', '=', 'Cust-001'])
        })

        it('overrides is_cancelled filter when specified', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getGLEntries({ is_cancelled: true })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['GL Entry', 'is_cancelled', '=', 1])
        })
    })

    describe('getVoucherLedger', () => {
        it('calls getGLEntries with voucher_type and voucher_no', async () => {
            const spy = jest.spyOn(accountingApi, 'getGLEntries').mockResolvedValueOnce([])
            await accountingApi.getVoucherLedger('Sales Invoice', 'SINV-001')
            expect(spy).toHaveBeenCalledWith({ voucher_type: 'Sales Invoice', voucher_no: 'SINV-001' })
        })
    })

    // ══════════════════════════════════════════════
    // Account Balance
    // ══════════════════════════════════════════════

    describe('getAccountBalance', () => {
        it('returns balance from API call', async () => {
            mockCall.mockResolvedValueOnce({ message: 1500 })
            const balance = await accountingApi.getAccountBalance('BANK-001', '2026-04-15', 'ACME')
            expect(balance).toBe(1500)
            expect(mockCall).toHaveBeenCalledWith(
                'erpnext.accounts.utils.get_balance_on',
                expect.objectContaining({ account: 'BANK-001', company: 'ACME' })
            )
        })

        it('returns 0 on API failure (non-critical, silent fallback)', async () => {
            mockCall.mockRejectedValueOnce(new Error('network error'))
            const balance = await accountingApi.getAccountBalance('BANK-001')
            expect(balance).toBe(0)
        })

        it('returns 0 when message is null', async () => {
            mockCall.mockResolvedValueOnce({ message: null })
            const balance = await accountingApi.getAccountBalance('ACC-001')
            expect(balance).toBe(0)
        })
    })

    describe('getMultipleBalances', () => {
        it('returns balances for all accounts', async () => {
            jest.spyOn(accountingApi, 'getAccountBalance')
                .mockResolvedValueOnce(1000)
                .mockResolvedValueOnce(250)

            const result = await accountingApi.getMultipleBalances(['BANK-001', 'CASH-001'])
            expect(result).toHaveLength(2)
            expect(result[0]).toMatchObject({ account: 'BANK-001', balance: 1000 })
            expect(result[1]).toMatchObject({ account: 'CASH-001', balance: 250 })
        })

        it('skips failed individual balance calls', async () => {
            jest.spyOn(accountingApi, 'getAccountBalance')
                .mockResolvedValueOnce(1000)
                .mockRejectedValueOnce(new Error('fail'))

            const result = await accountingApi.getMultipleBalances(['BANK-001', 'CASH-001'])
            expect(result).toHaveLength(1)
            expect(result[0].account).toBe('BANK-001')
        })

        it('returns empty array for empty accounts list', async () => {
            const result = await accountingApi.getMultipleBalances([])
            expect(result).toEqual([])
        })
    })

    // ══════════════════════════════════════════════
    // Journal Entries
    // ══════════════════════════════════════════════

    describe('getJournalEntries', () => {
        it('returns journal entries ordered by date desc', async () => {
            mockGetList.mockResolvedValueOnce([makeJE()])
            const result = await accountingApi.getJournalEntries()
            expect(result).toHaveLength(1)
            expect(mockGetList).toHaveBeenCalledWith('Journal Entry', expect.objectContaining({
                order_by: 'posting_date desc, creation desc',
            }))
        })

        it('filters by company', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getJournalEntries({ company: 'ACME' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Journal Entry', 'company', '=', 'ACME'])
        })

        it('filters by date range', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getJournalEntries({ from_date: '2026-01-01', to_date: '2026-04-15' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Journal Entry', 'posting_date', '>=', '2026-01-01'])
            expect(filters).toContainEqual(['Journal Entry', 'posting_date', '<=', '2026-04-15'])
        })

        it('maps Submitted status to docstatus=1', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getJournalEntries({ status: 'Submitted' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Journal Entry', 'docstatus', '=', 1])
        })

        it('maps Draft status to docstatus=0', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getJournalEntries({ status: 'Draft' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Journal Entry', 'docstatus', '=', 0])
        })

        it('maps Cancelled status to docstatus=2', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getJournalEntries({ status: 'Cancelled' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Journal Entry', 'docstatus', '=', 2])
        })
    })

    describe('getJournalEntry', () => {
        it('returns the journal entry when found', async () => {
            mockGet.mockResolvedValueOnce({ data: makeJE() })
            const je = await accountingApi.getJournalEntry('JV-001')
            expect(je.name).toBe('JV-001')
        })

        it('throws when not found', async () => {
            mockGet.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.getJournalEntry('MISSING')).rejects.toThrow('Journal Entry not found')
        })
    })

    describe('createJournalEntry', () => {
        it('creates a journal entry with accounts array', async () => {
            mockPost.mockResolvedValueOnce({ data: makeJE() })
            const result = await accountingApi.createJournalEntry({
                company: 'ACME',
                accounts: [
                    { account: 'CASH-001', debit_in_account_currency: 500 },
                    { account: 'REV-001', credit_in_account_currency: 500 },
                ],
            })
            expect(result.name).toBe('JV-001')
            expect(mockPost).toHaveBeenCalledWith('Journal Entry', expect.objectContaining({
                company: 'ACME',
                accounts: expect.arrayContaining([
                    expect.objectContaining({ account: 'CASH-001', debit_in_account_currency: 500 }),
                ]),
            }))
        })

        it('defaults voucher_type to Journal Entry', async () => {
            mockPost.mockResolvedValueOnce({ data: makeJE() })
            await accountingApi.createJournalEntry({
                company: 'ACME',
                accounts: [{ account: 'ACC-001', debit_in_account_currency: 100 }],
            })
            expect(mockPost).toHaveBeenCalledWith('Journal Entry', expect.objectContaining({
                voucher_type: 'Journal Entry',
            }))
        })

        it('includes optional user_remark when provided', async () => {
            mockPost.mockResolvedValueOnce({ data: makeJE() })
            await accountingApi.createJournalEntry({
                company: 'ACME',
                user_remark: 'Petty cash disbursement',
                accounts: [],
            })
            expect(mockPost).toHaveBeenCalledWith('Journal Entry', expect.objectContaining({
                user_remark: 'Petty cash disbursement',
            }))
        })

        it('throws when post returns no data', async () => {
            mockPost.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.createJournalEntry({
                company: 'ACME',
                accounts: [],
            })).rejects.toThrow('Failed to create Journal Entry')
        })
    })

    describe('submitJournalEntry', () => {
        it('fetches the doc then calls frappe.client.submit', async () => {
            const je = makeJE({ name: 'JV-001' })
            mockGet.mockResolvedValueOnce({ data: je })
            mockCall.mockResolvedValueOnce({ message: { ...je, docstatus: 1 } })

            const result = await accountingApi.submitJournalEntry('JV-001')
            expect(result.docstatus).toBe(1)
            expect(mockCall).toHaveBeenCalledWith('frappe.client.submit', expect.objectContaining({
                doc: expect.objectContaining({ name: 'JV-001', doctype: 'Journal Entry' }),
            }))
        })

        it('throws when JE not found before submitting', async () => {
            mockGet.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.submitJournalEntry('MISSING')).rejects.toThrow('Journal Entry not found: MISSING')
        })
    })

    describe('cancelJournalEntry', () => {
        it('calls frappe.client.cancel with correct args', async () => {
            mockCall.mockResolvedValueOnce({ message: makeJE({ docstatus: 2 }) })
            const result = await accountingApi.cancelJournalEntry('JV-001')
            expect(mockCall).toHaveBeenCalledWith('frappe.client.cancel', {
                doctype: 'Journal Entry',
                name: 'JV-001',
            })
            expect(result).toBeDefined()
        })
    })

    describe('deleteJournalEntry', () => {
        it('calls frappeClient.delete with correct doctype and name', async () => {
            mockDelete.mockResolvedValueOnce({})
            await accountingApi.deleteJournalEntry('JV-001')
            expect(mockDelete).toHaveBeenCalledWith('Journal Entry', 'JV-001')
        })
    })

    // ══════════════════════════════════════════════
    // Sales Invoices
    // ══════════════════════════════════════════════

    describe('getSalesInvoices', () => {
        it('returns sales invoices', async () => {
            mockGetList.mockResolvedValueOnce([makeSI()])
            const result = await accountingApi.getSalesInvoices()
            expect(result).toHaveLength(1)
            expect(mockGetList).toHaveBeenCalledWith('Sales Invoice', expect.objectContaining({
                order_by: 'posting_date desc, creation desc',
            }))
        })

        it('filters by company and customer', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getSalesInvoices({ company: 'ACME', customer: 'Cust-A' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Sales Invoice', 'company', '=', 'ACME'])
            expect(filters).toContainEqual(['Sales Invoice', 'customer', '=', 'Cust-A'])
        })

        it('adds overdue filters when overdue=true', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getSalesInvoices({ overdue: true })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Sales Invoice', 'outstanding_amount', '>', 0])
            expect(filters.some((f: any[]) => f[1] === 'due_date' && f[2] === '<')).toBe(true)
        })

        it('filters is_return as 0/1', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getSalesInvoices({ is_return: true })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Sales Invoice', 'is_return', '=', 1])
        })
    })

    describe('getSalesInvoice', () => {
        it('returns the invoice', async () => {
            mockGet.mockResolvedValueOnce({ data: makeSI() })
            const si = await accountingApi.getSalesInvoice('SINV-001')
            expect(si.name).toBe('SINV-001')
        })

        it('throws when not found', async () => {
            mockGet.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.getSalesInvoice('MISSING')).rejects.toThrow('Sales Invoice not found')
        })
    })

    describe('submitSalesInvoice', () => {
        it('fetches doc then submits', async () => {
            const si = makeSI()
            mockGet.mockResolvedValueOnce({ data: si })
            mockCall.mockResolvedValueOnce({ message: { ...si, docstatus: 1 } })
            const result = await accountingApi.submitSalesInvoice('SINV-001')
            expect(mockCall).toHaveBeenCalledWith('frappe.client.submit', expect.objectContaining({
                doc: expect.objectContaining({ doctype: 'Sales Invoice' }),
            }))
            expect(result.docstatus).toBe(1)
        })

        it('throws when invoice not found before submit', async () => {
            mockGet.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.submitSalesInvoice('MISSING')).rejects.toThrow('Sales Invoice not found: MISSING')
        })
    })

    describe('cancelSalesInvoice', () => {
        it('calls frappe.client.cancel', async () => {
            mockCall.mockResolvedValueOnce({ message: makeSI({ docstatus: 2 }) })
            await accountingApi.cancelSalesInvoice('SINV-001')
            expect(mockCall).toHaveBeenCalledWith('frappe.client.cancel', {
                doctype: 'Sales Invoice',
                name: 'SINV-001',
            })
        })
    })

    // ══════════════════════════════════════════════
    // Receivables / Payables
    // ══════════════════════════════════════════════

    describe('getTotalReceivables', () => {
        it('sums outstanding amounts correctly', async () => {
            jest.spyOn(accountingApi, 'getSalesInvoices').mockResolvedValueOnce([
                { outstanding_amount: 120.5 } as any,
                { outstanding_amount: 79.5 } as any,
                { outstanding_amount: undefined } as any,
            ])
            const total = await accountingApi.getTotalReceivables('ACME')
            expect(total).toBeCloseTo(200, 5)
        })

        it('returns 0 when no invoices', async () => {
            jest.spyOn(accountingApi, 'getSalesInvoices').mockResolvedValueOnce([])
            expect(await accountingApi.getTotalReceivables('ACME')).toBe(0)
        })
    })

    describe('getTotalPayables', () => {
        it('sums purchase invoice outstanding amounts', async () => {
            mockGetList.mockResolvedValueOnce([
                { outstanding_amount: 300 },
                { outstanding_amount: 45.25 },
                { outstanding_amount: undefined },
            ])
            const total = await accountingApi.getTotalPayables('ACME')
            expect(total).toBeCloseTo(345.25, 5)
            expect(mockGetList).toHaveBeenCalledWith('Purchase Invoice', expect.objectContaining({
                fields: ['outstanding_amount'],
            }))
        })

        it('returns 0 for empty purchase invoices', async () => {
            mockGetList.mockResolvedValueOnce([])
            expect(await accountingApi.getTotalPayables('ACME')).toBe(0)
        })
    })

    // ══════════════════════════════════════════════
    // Payment Entries
    // ══════════════════════════════════════════════

    describe('getPaymentEntries', () => {
        it('returns payment entries', async () => {
            mockGetList.mockResolvedValueOnce([makePE()])
            const result = await accountingApi.getPaymentEntries()
            expect(result).toHaveLength(1)
            expect(mockGetList).toHaveBeenCalledWith('Payment Entry', expect.objectContaining({
                order_by: 'posting_date desc, creation desc',
            }))
        })

        it('filters by company, party_type, party', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getPaymentEntries({ company: 'ACME', party_type: 'Customer', party: 'Cust-A' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Payment Entry', 'company', '=', 'ACME'])
            expect(filters).toContainEqual(['Payment Entry', 'party_type', '=', 'Customer'])
            expect(filters).toContainEqual(['Payment Entry', 'party', '=', 'Cust-A'])
        })

        it('filters by payment_type', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getPaymentEntries({ payment_type: 'Receive' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Payment Entry', 'payment_type', '=', 'Receive'])
        })

        it('filters by from_date and to_date', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getPaymentEntries({ from_date: '2026-01-01', to_date: '2026-04-15' })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Payment Entry', 'posting_date', '>=', '2026-01-01'])
            expect(filters).toContainEqual(['Payment Entry', 'posting_date', '<=', '2026-04-15'])
        })
    })

    describe('getPaymentEntry', () => {
        it('returns the payment entry', async () => {
            mockGet.mockResolvedValueOnce({ data: makePE() })
            const pe = await accountingApi.getPaymentEntry('PE-001')
            expect(pe.name).toBe('PE-001')
        })

        it('throws when not found', async () => {
            mockGet.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.getPaymentEntry('MISSING')).rejects.toThrow('Payment Entry not found')
        })
    })

    describe('createPaymentEntry', () => {
        it('creates a payment entry with all required fields', async () => {
            mockPost.mockResolvedValueOnce({ data: makePE() })
            const result = await accountingApi.createPaymentEntry({
                payment_type: 'Receive',
                party_type: 'Customer',
                party: 'Cust-A',
                company: 'ACME',
                paid_amount: 500,
                paid_from: 'REC-001',
                paid_to: 'CASH-001',
            })
            expect(result.name).toBe('PE-001')
            expect(mockPost).toHaveBeenCalledWith('Payment Entry', expect.objectContaining({
                payment_type: 'Receive',
                party_type: 'Customer',
                party: 'Cust-A',
                paid_amount: 500,
            }))
        })

        it('includes references when provided', async () => {
            mockPost.mockResolvedValueOnce({ data: makePE() })
            await accountingApi.createPaymentEntry({
                payment_type: 'Receive',
                party_type: 'Customer',
                party: 'Cust-A',
                company: 'ACME',
                paid_amount: 500,
                paid_from: 'REC-001',
                paid_to: 'CASH-001',
                references: [{ reference_doctype: 'Sales Invoice', reference_name: 'SINV-001', allocated_amount: 500 }],
            })
            expect(mockPost).toHaveBeenCalledWith('Payment Entry', expect.objectContaining({
                references: [{ reference_doctype: 'Sales Invoice', reference_name: 'SINV-001', allocated_amount: 500 }],
            }))
        })

        it('throws when post returns no data', async () => {
            mockPost.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.createPaymentEntry({
                payment_type: 'Receive',
                party_type: 'Customer',
                party: 'X',
                company: 'ACME',
                paid_amount: 100,
                paid_from: 'ACC-001',
                paid_to: 'ACC-002',
            })).rejects.toThrow('Failed to create Payment Entry')
        })
    })

    describe('submitPaymentEntry', () => {
        it('fetches doc then submits', async () => {
            const pe = makePE()
            mockGet.mockResolvedValueOnce({ data: pe })
            mockCall.mockResolvedValueOnce({ message: { ...pe, docstatus: 1 } })
            const result = await accountingApi.submitPaymentEntry('PE-001')
            expect(mockCall).toHaveBeenCalledWith('frappe.client.submit', expect.objectContaining({
                doc: expect.objectContaining({ doctype: 'Payment Entry' }),
            }))
            expect(result.docstatus).toBe(1)
        })

        it('throws when payment entry not found', async () => {
            mockGet.mockResolvedValueOnce({ data: null })
            await expect(accountingApi.submitPaymentEntry('MISSING')).rejects.toThrow('Payment Entry not found: MISSING')
        })
    })

    describe('cancelPaymentEntry', () => {
        it('calls frappe.client.cancel', async () => {
            mockCall.mockResolvedValueOnce({ message: makePE({ docstatus: 2 }) })
            await accountingApi.cancelPaymentEntry('PE-001')
            expect(mockCall).toHaveBeenCalledWith('frappe.client.cancel', {
                doctype: 'Payment Entry',
                name: 'PE-001',
            })
        })
    })

    // ══════════════════════════════════════════════
    // Cost Centers & Fiscal Years
    // ══════════════════════════════════════════════

    describe('getCostCenters', () => {
        it('returns cost centers excluding disabled', async () => {
            mockGetList.mockResolvedValueOnce([{ name: 'CC-001', cost_center_name: 'Main', company: 'ACME', is_group: 0 }])
            const result = await accountingApi.getCostCenters('ACME')
            expect(result).toHaveLength(1)
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Cost Center', 'disabled', '=', 0])
            expect(filters).toContainEqual(['Cost Center', 'company', '=', 'ACME'])
        })

        it('works without company filter', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getCostCenters()
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            const companyFilter = filters.find((f: any[]) => f[1] === 'company')
            expect(companyFilter).toBeUndefined()
        })
    })

    describe('getFiscalYears', () => {
        it('returns fiscal years ordered by start date desc', async () => {
            mockGetList.mockResolvedValueOnce([
                { name: '2026', year_start_date: '2026-01-01', year_end_date: '2026-12-31' },
            ])
            const result = await accountingApi.getFiscalYears()
            expect(result).toHaveLength(1)
            expect(mockGetList).toHaveBeenCalledWith('Fiscal Year', expect.objectContaining({
                order_by: 'year_start_date desc',
            }))
        })
    })

    describe('getCurrentFiscalYear', () => {
        it('returns fiscal year from API call', async () => {
            const fy = { name: '2026', year_start_date: '2026-01-01', year_end_date: '2026-12-31' }
            mockCall.mockResolvedValueOnce({ message: fy })
            const result = await accountingApi.getCurrentFiscalYear('ACME')
            expect(result).toEqual(fy)
            expect(mockCall).toHaveBeenCalledWith(
                'erpnext.accounts.utils.get_fiscal_year',
                expect.objectContaining({ company: 'ACME', as_dict: 1 })
            )
        })

        it('returns null on API error (silent fallback)', async () => {
            mockCall.mockRejectedValueOnce(new Error('no fiscal year'))
            const result = await accountingApi.getCurrentFiscalYear('ACME')
            expect(result).toBeNull()
        })
    })

    // ══════════════════════════════════════════════
    // Currency Exchange
    // ══════════════════════════════════════════════

    describe('getCurrencyExchangeRate', () => {
        it('returns exchange rate from API', async () => {
            mockCall.mockResolvedValueOnce({ message: 3.75 })
            const rate = await accountingApi.getCurrencyExchangeRate('USD', 'SAR', '2026-04-15')
            expect(rate).toBe(3.75)
            expect(mockCall).toHaveBeenCalledWith(
                'erpnext.setup.utils.get_exchange_rate',
                expect.objectContaining({ from_currency: 'USD', to_currency: 'SAR' })
            )
        })

        it('returns 1 on API error (fallback)', async () => {
            mockCall.mockRejectedValueOnce(new Error('rate not found'))
            const rate = await accountingApi.getCurrencyExchangeRate('USD', 'SAR')
            expect(rate).toBe(1)
        })
    })

    // ══════════════════════════════════════════════
    // Budgets
    // ══════════════════════════════════════════════

    describe('getBudgets', () => {
        it('returns budgets filtered by company and fiscal_year', async () => {
            mockGetList.mockResolvedValueOnce([{ name: 'BDG-001', company: 'ACME', fiscal_year: '2026' }])
            const result = await accountingApi.getBudgets({ company: 'ACME', fiscal_year: '2026' })
            expect(result).toHaveLength(1)
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toContainEqual(['Budget', 'company', '=', 'ACME'])
            expect(filters).toContainEqual(['Budget', 'fiscal_year', '=', '2026'])
        })

        it('returns all budgets when no filter provided', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getBudgets()
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            expect(filters).toHaveLength(0)
        })
    })

    // ══════════════════════════════════════════════
    // Reports
    // ══════════════════════════════════════════════

    describe('getTrialBalance', () => {
        it('returns trial balance rows', async () => {
            const rows = [{ account: 'CASH-001', closing_debit: 1000 }]
            mockCall.mockResolvedValueOnce({ message: { result: rows } })
            const result = await accountingApi.getTrialBalance({ company: 'ACME', fiscal_year: '2026' })
            expect(result).toEqual(rows)
            expect(mockCall).toHaveBeenCalledWith(
                'frappe.desk.query_report.run',
                expect.objectContaining({ report_name: 'Trial Balance' })
            )
        })

        it('throws when result is not an array', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: null } })
            await expect(accountingApi.getTrialBalance({ company: 'ACME', fiscal_year: '2026' }))
                .rejects.toThrow('Invalid Trial Balance response')
        })
    })

    describe('getBalanceSheetReport', () => {
        it('returns balance sheet rows', async () => {
            const rows = [{ account: 'Assets', closing_debit: 50000 }]
            mockCall.mockResolvedValueOnce({ message: { result: rows } })
            const result = await accountingApi.getBalanceSheetReport({ company: 'ACME', fiscal_year: '2026' })
            expect(result).toEqual(rows)
            expect(mockCall).toHaveBeenCalledWith(
                'frappe.desk.query_report.run',
                expect.objectContaining({ report_name: 'Balance Sheet' })
            )
        })

        it('throws when result is invalid', async () => {
            mockCall.mockResolvedValueOnce({ message: {} })
            await expect(accountingApi.getBalanceSheetReport({ company: 'ACME', fiscal_year: '2026' }))
                .rejects.toThrow('Invalid Balance Sheet response')
        })
    })

    describe('getProfitAndLossReport', () => {
        it('returns P&L rows', async () => {
            const rows = [{ account: 'Revenue', credit: 100000 }]
            mockCall.mockResolvedValueOnce({ message: { result: rows } })
            const result = await accountingApi.getProfitAndLossReport({ company: 'ACME', fiscal_year: '2026' })
            expect(result).toEqual(rows)
            expect(mockCall).toHaveBeenCalledWith(
                'frappe.desk.query_report.run',
                expect.objectContaining({ report_name: 'Profit and Loss Statement' })
            )
        })

        it('throws when result is invalid', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: 'bad' } })
            await expect(accountingApi.getProfitAndLossReport({ company: 'ACME', fiscal_year: '2026' }))
                .rejects.toThrow('Invalid Profit and Loss response')
        })
    })

    describe('getGeneralLedgerReport', () => {
        it('returns GL report rows', async () => {
            const rows = [{ name: 'GLE-001', account: 'CASH-001' }]
            mockCall.mockResolvedValueOnce({ message: { result: rows } })
            const result = await accountingApi.getGeneralLedgerReport({
                company: 'ACME',
                from_date: '2026-01-01',
                to_date: '2026-04-15',
            })
            expect(result).toEqual(rows)
            expect(mockCall).toHaveBeenCalledWith(
                'frappe.desk.query_report.run',
                expect.objectContaining({ report_name: 'General Ledger' })
            )
        })

        it('throws when result is invalid', async () => {
            mockCall.mockResolvedValueOnce({ message: {} })
            await expect(accountingApi.getGeneralLedgerReport({
                company: 'ACME',
                from_date: '2026-01-01',
                to_date: '2026-04-15',
            })).rejects.toThrow('Invalid General Ledger response')
        })
    })

    describe('getARAgingReport', () => {
        it('returns aging rows', async () => {
            const rows = [{ party: 'Cust-A', outstanding: 500 }]
            mockCall.mockResolvedValueOnce({ message: { result: rows } })
            const result = await accountingApi.getARAgingReport({ company: 'ACME' })
            expect(result).toEqual(rows)
            expect(mockCall).toHaveBeenCalledWith(
                'frappe.desk.query_report.run',
                expect.objectContaining({ report_name: 'Accounts Receivable' })
            )
        })

        it('returns empty array when no result', async () => {
            mockCall.mockResolvedValueOnce({ message: {} })
            const result = await accountingApi.getARAgingReport({ company: 'ACME' })
            expect(result).toEqual([])
        })

        it('passes customer filter', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: [] } })
            await accountingApi.getARAgingReport({ company: 'ACME', customer: 'Cust-A' })
            const args = mockCall.mock.calls[0][1]
            expect(args.filters.customer).toBe('Cust-A')
        })
    })

    describe('getAPAgingReport', () => {
        it('returns AP aging rows', async () => {
            const rows = [{ party: 'Sup-001', outstanding: 1000 }]
            mockCall.mockResolvedValueOnce({ message: { result: rows } })
            const result = await accountingApi.getAPAgingReport({ company: 'ACME' })
            expect(result).toEqual(rows)
            expect(mockCall).toHaveBeenCalledWith(
                'frappe.desk.query_report.run',
                expect.objectContaining({ report_name: 'Accounts Payable' })
            )
        })

        it('returns empty array when no result', async () => {
            mockCall.mockResolvedValueOnce({ message: {} })
            const result = await accountingApi.getAPAgingReport({ company: 'ACME' })
            expect(result).toEqual([])
        })
    })

    describe('getCashFlowReport', () => {
        it('returns parsed cash flow rows', async () => {
            const rawRows = [
                { section_name: 'Operating Activities', indent: 0, parent_section: null },
                { account_name: 'Net Income', indent: 1, total: 25000 },
            ]
            mockCall.mockResolvedValueOnce({ message: { result: rawRows } })
            const result = await accountingApi.getCashFlowReport({ company: 'ACME', fiscal_year: '2026' })
            expect(result).toHaveLength(2)
            expect(mockCall).toHaveBeenCalledWith(
                'frappe.desk.query_report.run',
                expect.objectContaining({ report_name: 'Cash Flow' })
            )
        })

        it('returns empty array when no rows', async () => {
            mockCall.mockResolvedValueOnce({ message: {} })
            const result = await accountingApi.getCashFlowReport({ company: 'ACME', fiscal_year: '2026' })
            expect(result).toEqual([])
        })
    })

    // ══════════════════════════════════════════════
    // Utility
    // ══════════════════════════════════════════════

    describe('getCompanies', () => {
        it('returns company list', async () => {
            mockGetList.mockResolvedValueOnce([{ name: 'ACME', company_name: 'ACME Corp', default_currency: 'SAR' }])
            const result = await accountingApi.getCompanies()
            expect(result).toHaveLength(1)
            expect(mockGetList).toHaveBeenCalledWith('Company', expect.objectContaining({
                fields: expect.arrayContaining(['name', 'company_name', 'default_currency']),
            }))
        })
    })

    describe('getModesOfPayment', () => {
        it('returns payment modes', async () => {
            mockGetList.mockResolvedValueOnce([{ name: 'Cash', type: 'Cash' }])
            const result = await accountingApi.getModesOfPayment()
            expect(result).toHaveLength(1)
            expect(mockGetList).toHaveBeenCalledWith('Mode of Payment', expect.any(Object))
        })
    })

    describe('searchAccounts', () => {
        it('calls getList with search filter', async () => {
            mockGetList.mockResolvedValueOnce([makeAccount()])
            const result = await accountingApi.searchAccounts('cash', 'ACME')
            expect(result).toHaveLength(1)
        })
    })

    // ══════════════════════════════════════════════
    // Dashboard
    // ══════════════════════════════════════════════

    describe('getDashboard', () => {
        it('aggregates receivables, payables, bank/cash balances and counters', async () => {
            jest.spyOn(accountingApi, 'getBankCashAccounts').mockResolvedValueOnce([
                makeAccount({ name: 'BANK-001', account_name: 'Main Bank', account_type: 'Bank', account_currency: 'SAR' }) as any,
                makeAccount({ name: 'CASH-001', account_name: 'Main Cash', account_type: 'Cash', account_currency: 'SAR' }) as any,
            ])
            jest.spyOn(accountingApi, 'getAccountBalance')
                .mockImplementation(async (acct: string) => acct === 'BANK-001' ? 1500 : 275)
            jest.spyOn(accountingApi, 'getTotalReceivables').mockResolvedValueOnce(980)
            jest.spyOn(accountingApi, 'getTotalPayables').mockResolvedValueOnce(620)

            mockGetList
                .mockResolvedValueOnce([{ name: 'SI-1' }, { name: 'SI-2' }])
                .mockResolvedValueOnce([{ name: 'PI-1' }])
                .mockResolvedValueOnce([{ name: 'SI-OV-1', outstanding_amount: 200 }])
                .mockResolvedValueOnce([{ name: 'PI-OV-1', outstanding_amount: 300 }, { name: 'PI-OV-2', outstanding_amount: 150 }])
                .mockResolvedValue([])   // root accounts or any further calls

            const dashboard = await accountingApi.getDashboard('ACME')

            expect(dashboard.total_receivables).toBe(980)
            expect(dashboard.total_payables).toBe(620)
            expect(dashboard.pending_sales_invoices).toBe(2)
            expect(dashboard.pending_purchase_invoices).toBe(1)
            expect(dashboard.overdue_sales_invoices).toBe(1)
            expect(dashboard.overdue_purchase_invoices).toBe(2)
            expect(dashboard.overdue_sales_amount).toBeCloseTo(200)
            expect(dashboard.overdue_purchase_amount).toBeCloseTo(450)
            expect(dashboard.bank_balances).toEqual([{
                account: 'BANK-001',
                account_name: 'Main Bank',
                balance: 1500,
                currency: 'SAR',
            }])
            expect(dashboard.cash_balances).toEqual([{
                account: 'CASH-001',
                account_name: 'Main Cash',
                balance: 275,
                currency: 'SAR',
            }])
        })

        it('throws when getTotalReceivables fails (critical failure)', async () => {
            jest.spyOn(accountingApi, 'getBankCashAccounts').mockResolvedValueOnce([])
            jest.spyOn(accountingApi, 'getTotalReceivables').mockRejectedValueOnce(new Error('Receivables failed'))
            jest.spyOn(accountingApi, 'getTotalPayables').mockResolvedValueOnce(0)
            mockGetList.mockResolvedValue([])
            await expect(accountingApi.getDashboard('ACME')).rejects.toThrow('Receivables failed')
        })

        it('throws when getTotalPayables fails (critical failure)', async () => {
            jest.spyOn(accountingApi, 'getBankCashAccounts').mockResolvedValueOnce([])
            jest.spyOn(accountingApi, 'getTotalReceivables').mockResolvedValueOnce(0)
            jest.spyOn(accountingApi, 'getTotalPayables').mockRejectedValueOnce(new Error('Payables failed'))
            mockGetList.mockResolvedValue([])
            await expect(accountingApi.getDashboard('ACME')).rejects.toThrow('Payables failed')
        })

        it('throws when one critical aggregate call fails', async () => {
            jest.spyOn(accountingApi, 'getBankCashAccounts').mockResolvedValueOnce([])
            jest.spyOn(accountingApi, 'getTotalReceivables').mockRejectedValueOnce(new Error('Receivables failed'))
            jest.spyOn(accountingApi, 'getTotalPayables').mockResolvedValueOnce(200)
            mockGetList
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
            await expect(accountingApi.getDashboard('ACME')).rejects.toThrow('Receivables failed')
        })
    })

    // ══════════════════════════════════════════════
    // Period Locking  (CRIT-1 regression tests)
    // ══════════════════════════════════════════════

    describe('getAccountingPeriods', () => {
        it('returns closed_documents from the document body, not the response wrapper', async () => {
            // frappeClient.getList returns the list of period stubs
            mockGetList.mockResolvedValueOnce([
                { name: 'FY2025', period_name: 'FY2025', start_date: '2025-01-01', end_date: '2025-12-31', company: 'ACME' },
            ])
            // frappeClient.get returns FrappeResponse<T> = { data: <document> }
            mockGet.mockResolvedValueOnce({
                data: {
                    name: 'FY2025',
                    period_name: 'FY2025',
                    start_date: '2025-01-01',
                    end_date: '2025-12-31',
                    company: 'ACME',
                    closed_documents: [
                        { document_type: 'Purchase Invoice', closed: 0 },
                        { document_type: 'Sales Invoice', closed: 1 },
                    ],
                },
            })

            const result = await accountingApi.getAccountingPeriods('ACME')

            expect(result).toHaveLength(1)
            // closed_documents must be populated — not undefined/empty (CRIT-1 regression)
            expect(result[0].closed_documents).toEqual([
                { document_type: 'Purchase Invoice', closed: 0 },
                { document_type: 'Sales Invoice', closed: 1 },
            ])
        })

        it('handles period with no closed_documents gracefully', async () => {
            mockGetList.mockResolvedValueOnce([
                { name: 'FY2024', period_name: 'FY2024', start_date: '2024-01-01', end_date: '2024-12-31' },
            ])
            mockGet.mockResolvedValueOnce({
                data: {
                    name: 'FY2024',
                    period_name: 'FY2024',
                    start_date: '2024-01-01',
                    end_date: '2024-12-31',
                    // no closed_documents field
                },
            })

            const result = await accountingApi.getAccountingPeriods()
            expect(result[0].closed_documents).toEqual([])
        })
    })

    describe('closePeriod', () => {
        it('sends closed_documents with closed=1 from the document body', async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    name: 'FY2025',
                    closed_documents: [
                        { document_type: 'Sales Invoice', closed: 0 },
                        { document_type: 'Purchase Invoice', closed: 0 },
                    ],
                },
            })
            mockPut.mockResolvedValueOnce({ data: {} })

            await accountingApi.closePeriod('FY2025')

            expect(mockPut).toHaveBeenCalledWith(
                'Accounting Period',
                'FY2025',
                expect.objectContaining({
                    closed_documents: [
                        expect.objectContaining({ document_type: 'Sales Invoice', closed: 1 }),
                        expect.objectContaining({ document_type: 'Purchase Invoice', closed: 1 }),
                    ],
                })
            )
        })

        it('sends empty closed_documents when period has none', async () => {
            mockGet.mockResolvedValueOnce({ data: { name: 'FY2025' } })
            mockPut.mockResolvedValueOnce({ data: {} })

            await accountingApi.closePeriod('FY2025')

            expect(mockPut).toHaveBeenCalledWith('Accounting Period', 'FY2025', { closed_documents: [] })
        })
    })

    describe('openPeriod', () => {
        it('sends closed_documents with closed=0 from the document body', async () => {
            mockGet.mockResolvedValueOnce({
                data: {
                    name: 'FY2025',
                    closed_documents: [
                        { document_type: 'Sales Invoice', closed: 1 },
                        { document_type: 'Purchase Invoice', closed: 1 },
                    ],
                },
            })
            mockPut.mockResolvedValueOnce({ data: {} })

            await accountingApi.openPeriod('FY2025')

            expect(mockPut).toHaveBeenCalledWith(
                'Accounting Period',
                'FY2025',
                expect.objectContaining({
                    closed_documents: [
                        expect.objectContaining({ document_type: 'Sales Invoice', closed: 0 }),
                        expect.objectContaining({ document_type: 'Purchase Invoice', closed: 0 }),
                    ],
                })
            )
        })

        it('sends empty closed_documents when period has none', async () => {
            mockGet.mockResolvedValueOnce({ data: { name: 'FY2025' } })
            mockPut.mockResolvedValueOnce({ data: {} })

            await accountingApi.openPeriod('FY2025')

            expect(mockPut).toHaveBeenCalledWith('Accounting Period', 'FY2025', { closed_documents: [] })
        })
    })

    // ══════════════════════════════════════════════
    // MED-1 — double-filter clobber regression
    // ══════════════════════════════════════════════

    describe('getSalesInvoices — caller filters must not clobber built filters (MED-1)', () => {
        it('merges caller-supplied extra filters with internally built param filters', async () => {
            mockGetList.mockResolvedValueOnce([])
            await accountingApi.getSalesInvoices({
                company: 'ACME',     // → function builds ['Sales Invoice', 'company', '=', 'ACME']
                status: 'Unpaid',    // → function builds ['Sales Invoice', 'status',  '=', 'Unpaid']
                filters: [           // caller extra constraint — must NOT overwrite above
                    ['Sales Invoice', 'docstatus', '=', 1],
                ],
            })
            const filters = mockGetList.mock.calls[0][1].filters as any[]
            // All three must survive in the request
            expect(filters).toContainEqual(['Sales Invoice', 'company', '=', 'ACME'])
            expect(filters).toContainEqual(['Sales Invoice', 'status', '=', 'Unpaid'])
            expect(filters).toContainEqual(['Sales Invoice', 'docstatus', '=', 1])
        })
    })

    // ══════════════════════════════════════════════
    // MED-2 — fiscalYearStart hardcoded to Jan 1
    // ══════════════════════════════════════════════

    describe('getVATSummary — fiscal year start from ERPNext, not hardcoded Jan 1 (MED-2)', () => {
        it('queries the Fiscal Year doctype to resolve from_date when omitted', async () => {
            mockGetList
                // After fix: first call is Fiscal Year lookup
                .mockResolvedValueOnce([{ name: 'FY2025-26', year_start_date: '2025-07-01', year_end_date: '2026-06-30' }])
                .mockResolvedValue([]) // vatAccounts → empty → early return (covers any further calls)

            await accountingApi.getVATSummary({ company: 'ACME' })

            // First call must be to Fiscal Year, not Account
            expect(mockGetList).toHaveBeenNthCalledWith(1, 'Fiscal Year', expect.objectContaining({
                filters: expect.arrayContaining([['Fiscal Year', 'company', '=', 'ACME']]),
            }))
        })

        it('uses the fetched fiscal year start date in GL queries instead of Jan 1', async () => {
            mockGetList
                .mockResolvedValueOnce([{ name: 'FY2025-26', year_start_date: '2025-07-01', year_end_date: '2026-06-30' }])
                .mockResolvedValueOnce([{ name: 'TAX-001', account_name: 'VAT Output', root_type: 'Liability' }])
                .mockResolvedValue([]) // GL entries (one or many per-account calls before MED-3 fix)

            await accountingApi.getVATSummary({ company: 'ACME' })

            // Third call (index 2) is the first GL Entry query; posting_date >= must be the fiscal year start
            expect(mockGetList).toHaveBeenNthCalledWith(3, 'GL Entry', expect.objectContaining({
                filters: expect.arrayContaining([['GL Entry', 'posting_date', '>=', '2025-07-01']]),
            }))
        })
    })

    // ══════════════════════════════════════════════
    // MED-3 — N+1 VAT GL queries
    // ══════════════════════════════════════════════

    describe('getVATSummary — single GL query for all VAT accounts (MED-3)', () => {
        it('fetches all VAT GL entries in one request using an "in" filter', async () => {
            mockGetList
                .mockResolvedValueOnce([
                    { name: 'TAX-001', account_name: 'VAT Output', root_type: 'Liability' },
                    { name: 'TAX-002', account_name: 'VAT Input', root_type: 'Asset' },
                ])
                .mockResolvedValue([]) // single bulk GL call (or per-account fallback before fix)

            await accountingApi.getVATSummary({
                company: 'ACME',
                from_date: '2026-01-01', // explicit → no fiscal year lookup (MED-2 won't add extra call)
                to_date: '2026-04-16',
            })

            // 2 total getList calls: vatAccounts + 1 bulk GL (not 3 = 1 + 2 per-account)
            expect(mockGetList).toHaveBeenCalledTimes(2)
            const glFilters = mockGetList.mock.calls[1][1].filters as any[]
            expect(glFilters).toContainEqual(['GL Entry', 'account', 'in', ['TAX-001', 'TAX-002']])
        })
    })

    // ══════════════════════════════════════════════
    // MED-4 — account filter double-encoded as JSON
    // ══════════════════════════════════════════════

    describe('getGeneralLedgerReport — account sent as plain string, not JSON (MED-4)', () => {
        it('sends account as a plain string, not JSON.stringify([account])', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: [] } })
            await accountingApi.getGeneralLedgerReport({
                company: 'ACME',
                from_date: '2026-01-01',
                to_date: '2026-04-16',
                account: 'Cash - ACME',
            })
            const callFilters = mockCall.mock.calls[0][1].filters
            expect(callFilters.account).toBe('Cash - ACME')
            expect(callFilters.account).not.toBe('["Cash - ACME"]')
        })

        it('sends empty string when account is not specified', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: [] } })
            await accountingApi.getGeneralLedgerReport({
                company: 'ACME',
                from_date: '2026-01-01',
                to_date: '2026-04-16',
            })
            const callFilters = mockCall.mock.calls[0][1].filters
            expect(callFilters.account).toBe('')
        })
    })

    // ══════════════════════════════════════════════
    // MED-7 — aging report unsafe any[] cast
    // ══════════════════════════════════════════════

    describe('getARAgingReport — safe array return (MED-7)', () => {
        it('returns an empty array when result is a non-array truthy value', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: 'unexpected-string' } })
            const result = await accountingApi.getARAgingReport({ company: 'ACME' })
            expect(Array.isArray(result)).toBe(true)
            expect(result).toEqual([])
        })

        it('returns an empty array when result is an object, not an array', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: { not: 'array' } } })
            const result = await accountingApi.getARAgingReport({ company: 'ACME' })
            expect(Array.isArray(result)).toBe(true)
            expect(result).toEqual([])
        })
    })

    describe('getAPAgingReport — safe array return (MED-7)', () => {
        it('returns an empty array when result is a non-array truthy value', async () => {
            mockCall.mockResolvedValueOnce({ message: { result: 42 } })
            const result = await accountingApi.getAPAgingReport({ company: 'ACME' })
            expect(Array.isArray(result)).toBe(true)
            expect(result).toEqual([])
        })
    })
})
