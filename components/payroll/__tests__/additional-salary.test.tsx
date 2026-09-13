import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdditionalSalaryList } from '@/components/payroll/additional-salary'
import { frappeClient } from '@/lib/api-client'

let isRTLMock = false
const tMock = (key: string) => key
const toastMock = jest.fn()

jest.mock('@/lib/api-client', () => ({
    frappeClient: {
        getAdditionalSalaries: jest.fn(),
        getSalaryStructureAssignments: jest.fn(),
        getEmployees: jest.fn(),
        getSalaryComponents: jest.fn(),
        createAdditionalSalary: jest.fn(),
        deleteAdditionalSalary: jest.fn(),
        get: jest.fn(),
        call: jest.fn(),
    },
}))

jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: toastMock }),
}))

jest.mock('@/lib/i18n', () => ({
    useI18n: () => ({
        t: (key: string) => (isRTLMock && key === 'pay.add.component_name.bonus' ? 'مكافأة' : tMock(key)),
        isRTL: isRTLMock,
    }),
}))

jest.mock('@/lib/auth-context', () => ({
    useAuth: () => ({
        user: { name: 'test@example.com', roles: ['System Manager'] },
        isAuthenticated: true,
        isAdmin: true,
        isHRManager: true,
        activeCompany: 'My Company',
        switchCompany: jest.fn(),
        companyInfo: { company: 'My Company', isAdmin: true, allCompanies: ['My Company'], employee: 'EMP-0001' },
    }),
    useAuthSafe: () => ({ user: { name: 'test@example.com' }, isAuthenticated: true }),
}))

jest.mock('@/hooks/use-company', () => ({
    useCompany: () => ({
        company: 'My Company',
        userCompany: 'My Company',
        isAdmin: true,
        allCompanies: ['My Company'],
        employee: 'EMP-0001',
        switchCompany: jest.fn(),
    }),
}))

describe('AdditionalSalaryList', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        isRTLMock = false
            ; (frappeClient.getAdditionalSalaries as any).mockResolvedValue([
                {
                    name: 'AS-0001',
                    employee: 'EMP-0001',
                    employee_name: 'Test Employee',
                    salary_component: 'Bonus',
                    type: 'Earning',
                    amount: 1000,
                    payroll_date: '2026-02-01',
                },
            ])
            ; (frappeClient.getEmployees as any).mockResolvedValue([{ name: 'EMP-0001', employee_name: 'Test Employee' }])
            ; (frappeClient.getSalaryComponents as any).mockResolvedValue([{ name: 'Bonus', type: 'Earning' }])
            ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValue([{ name: 'SSA-0001', employee: 'EMP-0001' }])
    })

    it('loads and renders additional salary records', async () => {
        render(<AdditionalSalaryList />)

        await waitFor(() => {
            expect(frappeClient.getAdditionalSalaries).toHaveBeenCalled()
            expect(screen.getByText('Test Employee')).toBeInTheDocument()
            expect(screen.getByText('Bonus')).toBeInTheDocument()
        })

        expect(screen.getByText('pay.add.title')).toBeInTheDocument()
    })

    it('translates salary component names in Arabic mode when mapping exists', async () => {
        isRTLMock = true
        render(<AdditionalSalaryList />)

        await waitFor(() => {
            expect(screen.getByText('مكافأة')).toBeInTheDocument()
        })
    })

    it('opens create dialog from add button', async () => {
        render(<AdditionalSalaryList />)

        await waitFor(() => {
            expect(screen.getByText('pay.add.new')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('pay.add.new'))
        expect(screen.getByText('pay.add.create')).toBeInTheDocument()
    })

    it('validates required fields before create', async () => {
        render(<AdditionalSalaryList />)

        await waitFor(() => {
            expect(screen.getByText('pay.add.new')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('pay.add.new'))
        fireEvent.click(screen.getByText('pay.add.create'))

        expect(toastMock).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'pay.add.required', variant: 'destructive' })
        )
        expect(frappeClient.createAdditionalSalary).not.toHaveBeenCalled()
    })

    it('creates additional salary with correct payload', async () => {
        ; (frappeClient.createAdditionalSalary as any).mockResolvedValue({ name: 'AS-0002' })

        render(<AdditionalSalaryList />)

        await waitFor(() => {
            expect(screen.getByText('pay.add.new')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('pay.add.new'))

        const triggers = screen.getAllByRole('combobox')
        fireEvent.click(triggers[0])
        fireEvent.click(screen.getByText('Test Employee (EMP-0001)'))

        fireEvent.click(triggers[1])
        fireEvent.click(screen.getAllByText('Bonus')[1])

        const amountInput = screen.getByPlaceholderText('0.00')
        fireEvent.change(amountInput, { target: { value: '1500' } })

        fireEvent.click(screen.getByText('pay.add.create'))

        await waitFor(() => {
            expect(frappeClient.createAdditionalSalary).toHaveBeenCalledWith(
                expect.objectContaining({
                    employee: 'EMP-0001',
                    salary_component: 'Bonus',
                    amount: 1500,
                    company: 'My Company',
                    currency: 'SAR',
                })
            )
        })
    })

    it('deletes additional salary when delete button is clicked', async () => {
        ; (frappeClient.deleteAdditionalSalary as any).mockResolvedValue(undefined)

        render(<AdditionalSalaryList />)

        await waitFor(() => {
            expect(screen.getByLabelText('pay.add.delete')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByLabelText('pay.add.delete'))

        // Wait for ConfirmDialog to open, then click the confirm button
        await waitFor(() => {
            expect(screen.getByText('Confirm')).toBeInTheDocument()
        })
        fireEvent.click(screen.getByText('Confirm'))

        await waitFor(() => {
            expect(frappeClient.call).toHaveBeenCalledWith(
                'frappe.client.cancel',
                { doctype: 'Additional Salary', name: 'AS-0001' }
            )
        })

        await waitFor(() => {
            expect(frappeClient.deleteAdditionalSalary).toHaveBeenCalledWith('AS-0001')
        })
    })

    it('blocks creation when employee has no fixed salary assignment', async () => {
        ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValueOnce([])

        render(<AdditionalSalaryList />)

        await waitFor(() => {
            expect(screen.getByText('pay.add.new')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('pay.add.new'))

        const triggers = screen.getAllByRole('combobox')
        fireEvent.click(triggers[0])
        fireEvent.click(screen.getByText('Test Employee (EMP-0001)'))

        fireEvent.click(triggers[1])
        fireEvent.click(screen.getAllByText('Bonus')[1])

        const amountInput = screen.getByPlaceholderText('0.00')
        fireEvent.change(amountInput, { target: { value: '500' } })

        fireEvent.click(screen.getByText('pay.add.create'))

        await waitFor(() => {
            expect(toastMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'pay.add.no_assignment_title',
                    description: 'pay.add.no_assignment_desc',
                    variant: 'destructive',
                })
            )
        })

        expect(frappeClient.createAdditionalSalary).not.toHaveBeenCalled()
    })
})
