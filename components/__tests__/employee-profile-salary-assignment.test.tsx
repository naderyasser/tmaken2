/**
 * EmployeeProfile — salary-assignment payload.
 *
 * The form used to be a 5-step wizard; it is a single page now, so these tests
 * fill every section directly and press Save once. The section headings are
 * still asserted because they are what tells us the page rendered whole.
 */
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmployeeProfile } from '@/components/employee/employee-profile'
import { frappeClient } from '@/lib/api-client'

// Dates are picked through a Popover + Calendar now, not a native <input type="date">.
// This suite is about the salary-assignment payload, not the picker, so stand it in
// with a plain date input and keep driving it with fireEvent.change.
jest.mock('@/components/ui/localized-date-input', () => ({
    LocalizedDateInput: ({ value, onChange, id, 'aria-label': ariaLabel }: any) => (
        <input
            type="date"
            id={id}
            aria-label={ariaLabel}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}))

jest.mock('@/components/employee/employee-documents', () => ({
    EmployeeDocuments: () => null,
}))

jest.mock('@/components/ui/confirm-dialog', () => ({
    ConfirmDialog: () => null,
}))

jest.mock('@/lib/use-navigation-guard', () => ({
    useNavigationGuard: () => ({
        guardOpen: false,
        confirmNavigation: jest.fn(),
        cancelNavigation: jest.fn(),
        guardedNavigate: (cb: () => void) => cb(),
    }),
}))

jest.mock('@/lib/utils', () => {
    const actual = jest.requireActual('@/lib/utils')
    return {
        ...actual,
        frappeImageUrl: (value: string) => value,
    }
})

jest.mock('@/lib/api', () => ({
    updateDoc: jest.fn(),
}))

jest.mock('@/lib/auth-context', () => ({
    useAuthSafe: () => ({
        user: { name: 'admin@example.com' },
        refreshUser: jest.fn(),
    }),
}))

jest.mock('@/lib/i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
        lang: 'en',
        isRTL: false,
    }),
}))

jest.mock('@/lib/api-client', () => ({
    frappeClient: {
        get: jest.fn(),
        createEmployee: jest.fn(),
        updateEmployee: jest.fn(),
        getEmployee: jest.fn(),
        getSalaryStructures: jest.fn(),
        getSalaryStructureAssignments: jest.fn(),
        createSalaryStructureAssignment: jest.fn(),
        updateSalaryStructureAssignment: jest.fn(),
        getSalaryComponent: jest.fn(),
        createSalaryComponent: jest.fn(),
        createSalaryStructure: jest.fn(),
        call: jest.fn(),
    },
}))

/** Nationality is a searchable combobox, and it is required — pick the first option. */
async function pickNationality() {
    const trigger = await screen.findByText('Select Nationality')
    fireEvent.click(trigger)
    const option = await screen.findByText('Saudi Arabia')
    fireEvent.click(option)
}

describe('EmployeeProfile Salary Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks()

        window.scrollTo = jest.fn()

            ; (frappeClient.get as jest.Mock).mockImplementation((doctype: string) => {
                if (doctype === 'Company') return Promise.resolve({ data: [{ name: 'My Company' }] })
                if (doctype === 'Department') return Promise.resolve({ data: [] })
                if (doctype === 'Designation') return Promise.resolve({ data: [] })
                if (doctype === 'Branch') return Promise.resolve({ data: [] })
                if (doctype === 'Shift Type') return Promise.resolve({ data: [] })
                if (doctype === 'Country') return Promise.resolve({ data: [{ name: 'Saudi Arabia' }] })
                return Promise.resolve({ data: [] })
            })

            ; (frappeClient.createEmployee as jest.Mock).mockResolvedValue({
                name: 'EMP-NEW-001',
                employee_name: 'Ali QA',
            })

            ; (frappeClient.getSalaryStructures as jest.Mock).mockResolvedValue([
                { name: 'Main Structure', company: 'My Company', is_active: 1 },
            ])

            ; (frappeClient.createSalaryStructureAssignment as jest.Mock).mockResolvedValue({
                name: 'SSA-NEW-001',
            })
    })

    it('creates employee and sends correct salary assignment payload', async () => {
        render(<EmployeeProfile onBack={jest.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('New Employee')).toBeInTheDocument()
        })

        fireEvent.change(screen.getByPlaceholderText('Enter first name'), {
            target: { value: 'Ali' },
        })

        fireEvent.change(screen.getByDisplayValue('Select Gender'), {
            target: { value: 'Male' },
        })

        const dateInputs = document.querySelectorAll('input[type="date"]')
        expect(dateInputs.length).toBeGreaterThanOrEqual(2)
        fireEvent.change(dateInputs[0], { target: { value: '1994-01-10' } })
        fireEvent.change(dateInputs[1], { target: { value: '2026-04-27' } })


        await waitFor(() => {
            expect(screen.getAllByText('Company Details').length).toBeGreaterThan(0)
        })

        fireEvent.change(screen.getByDisplayValue('My Company'), {
            target: { value: 'My Company' },
        })

        fireEvent.change(screen.getByPlaceholderText('Enter base salary (optional)'), {
            target: { value: '4500' },
        })


        await waitFor(() => {
            expect(screen.getAllByText('Work Settings').length).toBeGreaterThan(0)
        })

        fireEvent.click(screen.getByLabelText('Create user account for this employee (allows app login)'))

        await pickNationality()

        fireEvent.click(screen.getByRole('button', { name: /Save Employee/i }))

        await waitFor(() => {
            expect(frappeClient.createEmployee).toHaveBeenCalledWith(
                expect.objectContaining({
                    first_name: 'Ali',
                    company: 'My Company',
                    date_of_joining: '2026-04-27',
                })
            )
        })

        await waitFor(() => {
            expect(frappeClient.createSalaryStructureAssignment).toHaveBeenCalledWith(
                expect.objectContaining({
                    employee: 'EMP-NEW-001',
                    salary_structure: 'Main Structure',
                    from_date: '2026-04-27',
                    base: 4500,
                    company: 'My Company',
                })
            )
        })
    })

    it('falls back to unfiltered structure query when company-scoped query fails and still assigns salary', async () => {
        ; (frappeClient.getSalaryStructures as jest.Mock)
            .mockRejectedValueOnce(new Error('Unknown column is_active'))
            .mockResolvedValueOnce([{ name: 'Fallback Structure', company: 'My Company' }])

        render(<EmployeeProfile onBack={jest.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('New Employee')).toBeInTheDocument()
        })

        fireEvent.change(screen.getByPlaceholderText('Enter first name'), {
            target: { value: 'Mona' },
        })
        fireEvent.change(screen.getByDisplayValue('Select Gender'), {
            target: { value: 'Female' },
        })

        const dateInputs = document.querySelectorAll('input[type="date"]')
        fireEvent.change(dateInputs[0], { target: { value: '1993-02-10' } })
        fireEvent.change(dateInputs[1], { target: { value: '2026-04-27' } })

        await waitFor(() => {
            expect(screen.getAllByText('Company Details').length).toBeGreaterThan(0)
        })

        fireEvent.change(screen.getByDisplayValue('My Company'), {
            target: { value: 'My Company' },
        })
        fireEvent.change(screen.getByPlaceholderText('Enter base salary (optional)'), {
            target: { value: '5200' },
        })

        fireEvent.click(screen.getByLabelText('Create user account for this employee (allows app login)'))
        await pickNationality()

        fireEvent.click(screen.getByRole('button', { name: /Save Employee/i }))

        await waitFor(() => {
            expect(frappeClient.getSalaryStructures).toHaveBeenNthCalledWith(1, {
                fields: ['name', 'company', 'is_active'],
                filters: [['Salary Structure', 'company', '=', 'My Company']],
            })
        })

        await waitFor(() => {
            expect(frappeClient.getSalaryStructures).toHaveBeenNthCalledWith(2, {
                fields: ['name', 'company', 'is_active'],
                filters: undefined,
            })
        })

        await waitFor(() => {
            expect(frappeClient.createSalaryStructureAssignment).toHaveBeenCalledWith(
                expect.objectContaining({
                    employee: 'EMP-NEW-001',
                    salary_structure: 'Fallback Structure',
                    from_date: '2026-04-27',
                    base: 5200,
                    company: 'My Company',
                })
            )
        })
    })

    it('keeps employee creation successful and shows warning when no salary structure exists', async () => {
        ; (frappeClient.getSalaryStructures as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([])

        render(<EmployeeProfile onBack={jest.fn()} />)

        await waitFor(() => {
            expect(screen.getByText('New Employee')).toBeInTheDocument()
        })

        fireEvent.change(screen.getByPlaceholderText('Enter first name'), {
            target: { value: 'Karim' },
        })
        fireEvent.change(screen.getByDisplayValue('Select Gender'), {
            target: { value: 'Male' },
        })

        const dateInputs = document.querySelectorAll('input[type="date"]')
        fireEvent.change(dateInputs[0], { target: { value: '1990-01-01' } })
        fireEvent.change(dateInputs[1], { target: { value: '2026-04-27' } })

        await waitFor(() => {
            expect(screen.getAllByText('Company Details').length).toBeGreaterThan(0)
        })

        fireEvent.change(screen.getByDisplayValue('My Company'), {
            target: { value: 'My Company' },
        })
        fireEvent.change(screen.getByPlaceholderText('Enter base salary (optional)'), {
            target: { value: '3900' },
        })

        fireEvent.click(screen.getByLabelText('Create user account for this employee (allows app login)'))
        await pickNationality()

        fireEvent.click(screen.getByRole('button', { name: /Save Employee/i }))

        await waitFor(() => {
            expect(frappeClient.createEmployee).toHaveBeenCalled()
        })

        expect(frappeClient.createSalaryStructureAssignment).not.toHaveBeenCalled()

        await waitFor(() => {
            expect(screen.getByText(/Warning: Employee created, but no salary structure was found to assign base salary\./i)).toBeInTheDocument()
        })
    })

    it('updates salary for existing employee on edit', async () => {
        Element.prototype.scrollIntoView = jest.fn()
        window.HTMLElement.prototype.scrollIntoView = jest.fn()

        ; (frappeClient.getEmployee as jest.Mock).mockResolvedValue({
            name: 'EMP-001',
            first_name: 'Sara',
            last_name: 'Ali',
            employee_name: 'Sara Ali',
            gender: 'Female',
            date_of_birth: '1995-05-15',
            date_of_joining: '2025-01-01',
            company: 'My Company',
            status: 'Active',
            user_id: '',
            image: '',
        })
        ; (frappeClient.getSalaryStructureAssignments as jest.Mock).mockResolvedValue([
            { name: 'SSA-001', base: 3000, salary_structure: 'Default Structure' },
        ])
        ; (frappeClient.updateEmployee as jest.Mock).mockResolvedValue({
            name: 'EMP-001',
            employee_name: 'Sara Ali',
        })
        ; (frappeClient.createSalaryStructureAssignment as jest.Mock).mockResolvedValue({
            name: 'SSA-NEW-001',
        })
        ; (frappeClient.call as jest.Mock).mockResolvedValue({ message: {} })

        render(<EmployeeProfile onBack={jest.fn()} employeeId="EMP-001" />)

        await screen.findByText('Edit Employee')

        await screen.findAllByText('First Name')


        await screen.findAllByText('Base Salary')

        const salaryInput = screen.getByPlaceholderText('Enter base salary (optional)')
        expect(salaryInput).toHaveValue(3000)

        fireEvent.change(salaryInput, { target: { value: '5500' } })


        await screen.findAllByText('Mobile Number')


        await screen.findAllByText('Work Settings')



        await pickNationality()

        fireEvent.click(screen.getByRole('button', { name: /Save Employee/i }))

        await waitFor(() => {
            expect(frappeClient.updateEmployee).toHaveBeenCalledWith('EMP-001', expect.objectContaining({
                first_name: 'Sara',
            }))
        })

        await waitFor(() => {
            expect(frappeClient.call).toHaveBeenCalledWith(
                'frappe.client.cancel',
                { doctype: 'Salary Structure Assignment', name: 'SSA-001' }
            )
        })

        await waitFor(() => {
            expect(frappeClient.createSalaryStructureAssignment).toHaveBeenCalledWith(
                expect.objectContaining({
                    employee: 'EMP-001',
                    base: 5500,
                    company: 'My Company',
                })
            )
        })
    }, 30000)
})
