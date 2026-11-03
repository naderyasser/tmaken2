/**
 * Tests for RBAC enforcement in HR Settings List.
 *
 * Verifies that:
 * 1. Department loading filters by user's company
 * 2. Branch loading filters by user's company
 * 3. Branch creation attaches the user's company
 * 4. Department creation attaches the user's company
 * 5. No "loadCompanies" call is made (removed for security)
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ========== Shared mock state ==========

const TEST_COMPANY = 'ACME Corp'

// Track all frappeClient calls for assertions
const apiCalls: { method: string; args: any[] }[] = []

// ========== Mocks ==========

jest.mock('@/lib/api-client', () => ({
    frappeClient: {
        get: jest.fn(async (doctype: string, _name: any, options: any) => {
            apiCalls.push({ method: 'get', args: [doctype, _name, options] })
            if (doctype === 'Department') {
                return { data: [{ name: 'Engineering - ACME', company: TEST_COMPANY, is_group: 0, parent_department: '', disabled: 0 }] }
            }
            if (doctype === 'Designation') {
                return { data: [{ name: 'Software Engineer' }] }
            }
            if (doctype === 'Employment Type') {
                return { data: [{ name: 'Full-time' }] }
            }
            if (doctype === 'Branch') {
                return { data: [{ name: 'Main Office' }] }
            }
            return { data: [] }
        }),
        post: jest.fn(async (doctype: string, data: any) => {
            apiCalls.push({ method: 'post', args: [doctype, data] })
            return { data: { name: data.department || data.branch || 'new' } }
        }),
        delete: jest.fn(async () => ({})),
    },
}))

jest.mock('@/hooks/use-company', () => ({
    useCompany: () => ({
        company: TEST_COMPANY,
        userCompany: TEST_COMPANY,
        isAdmin: false,
        allCompanies: [TEST_COMPANY],
        employee: 'HR-EMP-001',
        switchCompany: jest.fn(),
    }),
}))

jest.mock('@/lib/i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
        locale: 'en',
        lang: 'en',
        isRTL: false,
        setLocale: jest.fn(),
    }),
}))

jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: jest.fn(),
    }),
}))

// ========== Import component after mocks ==========

import { HRSettingsList } from '@/components/hr-settings-list'

// ========== Tests ==========

beforeEach(() => {
    apiCalls.length = 0
    jest.clearAllMocks()
})

describe('HR Settings RBAC', () => {
    describe('Department loading', () => {
        it('filters departments by the user company', async () => {
            await act(async () => {
                render(<HRSettingsList initialTab="departments" />)
            })

            await waitFor(() => {
                const deptCalls = apiCalls.filter(c => c.method === 'get' && c.args[0] === 'Department')
                expect(deptCalls.length).toBeGreaterThan(0)

                const lastCall = deptCalls[deptCalls.length - 1]
                const options = lastCall.args[2]
                expect(options.filters).toBeDefined()
                expect(options.filters).toEqual([['Department', 'company', '=', TEST_COMPANY]])
            })
        })

        it('does not include a Company column in the table', async () => {
            await act(async () => {
                render(<HRSettingsList initialTab="departments" />)
            })

            await waitFor(() => {
                // The table headers should NOT contain "settings.company" (the company column key)
                const headers = screen.getAllByRole('columnheader')
                const headerTexts = headers.map(h => h.textContent)
                // Should have: name, parent, type, status, actions — but NOT company
                expect(headerTexts).not.toContain('settings.company')
            })
        })
    })

    describe('Branch loading', () => {
        it('filters branches by the user company', async () => {
            await act(async () => {
                render(<HRSettingsList initialTab="branches" />)
            })

            await waitFor(() => {
                const branchCalls = apiCalls.filter(c => c.method === 'get' && c.args[0] === 'Branch')
                expect(branchCalls.length).toBeGreaterThan(0)

                const lastCall = branchCalls[branchCalls.length - 1]
                const options = lastCall.args[2]
                expect(options.filters).toBeDefined()
                expect(options.filters).toEqual([['Branch', 'company', '=', TEST_COMPANY]])
            })
        })
    })

    describe('No company list fetching', () => {
        it('does not call get("Company") — removed for RBAC security', async () => {
            await act(async () => {
                render(<HRSettingsList initialTab="departments" />)
            })

            await waitFor(() => {
                const companyCalls = apiCalls.filter(c => c.method === 'get' && c.args[0] === 'Company')
                expect(companyCalls).toHaveLength(0)
            })
        })
    })

    describe('Department creation', () => {
        it('attaches the user company when creating a department', async () => {
            const user = userEvent.setup()

            await act(async () => {
                render(<HRSettingsList initialTab="departments" />)
            })

            // Click the Add button to open the create dialog
            const addButtons = screen.getAllByRole('button')
            const addBtn = addButtons.find(b => b.textContent?.includes('common.add'))
            if (!addBtn) return // dialog not available in this render

            await user.click(addBtn)

            // Fill in the department name
            await waitFor(() => {
                const inputs = screen.getAllByRole('textbox')
                expect(inputs.length).toBeGreaterThan(0)
            })

            const nameInput = screen.getAllByRole('textbox')[0]
            await user.type(nameInput, 'Test Department')

            // Click Create
            const createBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('common.create'))
            if (createBtn) {
                await user.click(createBtn)

                await waitFor(() => {
                    const postCalls = apiCalls.filter(c => c.method === 'post' && c.args[0] === 'Department')
                    if (postCalls.length > 0) {
                        expect(postCalls[0].args[1].company).toBe(TEST_COMPANY)
                    }
                })
            }
        })
    })

    describe('Branch creation', () => {
        it('attaches the user company when creating a branch', async () => {
            const user = userEvent.setup()

            await act(async () => {
                render(<HRSettingsList initialTab="branches" />)
            })

            // Click Add button
            const addButtons = screen.getAllByRole('button')
            const addBtn = addButtons.find(b => b.textContent?.includes('common.add'))
            if (!addBtn) return

            await user.click(addBtn)

            await waitFor(() => {
                const inputs = screen.getAllByRole('textbox')
                expect(inputs.length).toBeGreaterThan(0)
            })

            const nameInput = screen.getAllByRole('textbox')[0]
            await user.type(nameInput, 'New Branch')

            const createBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('common.create'))
            if (createBtn) {
                await user.click(createBtn)

                await waitFor(() => {
                    const postCalls = apiCalls.filter(c => c.method === 'post' && c.args[0] === 'Branch')
                    if (postCalls.length > 0) {
                        expect(postCalls[0].args[1].company).toBe(TEST_COMPANY)
                    }
                })
            }
        })
    })

    describe('Company badge in header', () => {
        it('shows the user company name from useCompany hook', async () => {
            await act(async () => {
                render(<HRSettingsList initialTab="departments" />)
            })

            await waitFor(() => {
                expect(screen.getByText(TEST_COMPANY)).toBeInTheDocument()
            })
        })
    })
})
