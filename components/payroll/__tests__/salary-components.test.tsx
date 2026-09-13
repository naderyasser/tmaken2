import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SalaryComponentsList } from '@/components/payroll/salary-components'
import { frappeClient } from '@/lib/api-client'

jest.mock('@/lib/api-client', () => ({
    frappeClient: {
        getSalaryComponents: jest.fn(),
        createSalaryComponent: jest.fn(),
        updateSalaryComponent: jest.fn(),
        deleteSalaryComponent: jest.fn(),
    },
}))

jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: jest.fn(),
    }),
}))

jest.mock('@/lib/i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
        isRTL: false,
    }),
}))

describe('SalaryComponentsList', () => {
    const mockComponents = [
        {
            name: 'Basic Salary',
            type: 'Earning',
            description: 'Monthly basic salary',
            amount: 10000,
        },
        {
            name: 'Tax Deduction',
            type: 'Deduction',
            description: 'Income tax',
            amount: 0,
        },
    ]

    beforeEach(() => {
        jest.clearAllMocks()
            ; (frappeClient.getSalaryComponents as any).mockResolvedValue(mockComponents)
    })

    it('renders salary components list', async () => {
        render(<SalaryComponentsList />)

        await waitFor(() => {
            expect(screen.getByText('Basic Salary')).toBeInTheDocument()
            expect(screen.getByText('Tax Deduction')).toBeInTheDocument()
        })
    })

    it('opens create dialog when add button is clicked', async () => {
        render(<SalaryComponentsList />)

        await waitFor(() => {
            expect(screen.getByText('pay.comp.add')).toBeInTheDocument()
        })

        const addButton = screen.getByText('pay.comp.add')
        fireEvent.click(addButton)

        expect(screen.getByText('pay.comp.create_title')).toBeInTheDocument()
    })

    it('searches components by name', async () => {
        render(<SalaryComponentsList />)

        await waitFor(() => {
            expect(screen.getByText('Basic Salary')).toBeInTheDocument()
            expect(screen.getByText('Tax Deduction')).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText('pay.comp.search')
        fireEvent.change(searchInput, { target: { value: 'Basic' } })

        expect(screen.getByText('Basic Salary')).toBeInTheDocument()
    })

    it('loads components on mount', async () => {
        render(<SalaryComponentsList />)

        await waitFor(() => {
            expect(frappeClient.getSalaryComponents).toHaveBeenCalled()
        })
    })
})
