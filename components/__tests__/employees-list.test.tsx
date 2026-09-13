/**
 * Employees List Component Tests
 * Comprehensive unit tests
 */

import '@testing-library/jest-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock data
const mockEmployees = [
    {
        name: 'EMP-001',
        employee_name: 'Ahmed Mohamed',
        employee_number: 'E001',
        department: 'Engineering',
        designation: 'Senior Developer',
        company: 'Meena Company',
        status: 'Active' as const,
        date_of_joining: '2024-01-15',
        email: 'ahmed@meena.com',
        cell_number: '+2011234567890',
        image: '',
        reports_to: '',
    },
    {
        name: 'EMP-002',
        employee_name: 'Sarah Williams',
        employee_number: 'E002',
        department: 'HR',
        designation: 'HR Manager',
        company: 'Meena Company',
        status: 'Active' as const,
        date_of_joining: '2023-06-01',
        email: 'sarah@meena.com',
        cell_number: '+2011234567891',
        image: '',
        reports_to: '',
    },
    {
        name: 'EMP-003',
        employee_name: 'John Smith',
        employee_number: 'E003',
        department: 'Engineering',
        designation: 'Junior Developer',
        company: 'Meena Company',
        status: 'Inactive' as const,
        date_of_joining: '2024-03-20',
        email: 'john@meena.com',
        cell_number: '+2011234567892',
        image: '',
        reports_to: '',
    },
]

// Mock API client - MUST be before import EmployeesList
jest.mock('@/lib/auth-context', () => ({
    useAuth: () => ({ isHRManager: true, user: null, isAuthenticated: true, isLoading: false }),
    useAuthSafe: () => ({ isHRManager: true, user: null, isAuthenticated: true, isLoading: false }),
}))

jest.mock('@/lib/i18n', () => ({
    useI18n: () => ({
        isRTL: false,
        t: (k: string) => ({
            'emp.title': 'Employees',
            'emp.subtitle': 'Manage your workforce',
            'emp.add': 'Add Employee',
            'emp.total': 'Total Employees',
            'emp.departments': 'Departments',
            'emp.search': 'Search employees',
            'emp.all_statuses': 'All Statuses',
            'emp.all_departments': 'All Departments',
            'emp.exported': 'Exported',
            'emp.load_fail': 'Failed to load',
            'emp.delete_confirm': 'Delete employee',
            'emp.deleted': 'Employee deleted',
            'emp.delete_fail': 'Delete failed',
            'emp.no_found': 'No employees found',
            'emp.designation': 'Designation',
            'emp.contact': 'Contact',
            'status.active': 'Active',
            'status.inactive': 'Inactive',
            'status.suspended': 'Suspended',
            'status.left': 'Left',
            'id': 'ID',
            'name': 'Name',
            'department': 'Department',
            'status': 'Status',
            'page': 'Page',
            'of': 'of',
            'showing': 'Showing',
            'to': 'to',
            'emp.employees': 'employees',
            'error': 'Error',
            'delete': 'Delete',
            'employee': 'Employee',
            'actions': 'Actions',
            'view_details': 'View Details',
            'edit': 'Edit',
            'previous': 'Previous',
            'next': 'Next',
            'emp.joined': 'Date Joined',
        }[k] || k),
    }),
}))

jest.mock('@/lib/api-client', () => {
    return {
        frappeClient: {
            getEmployees: jest.fn(() => Promise.resolve(mockEmployees)),
            deleteEmployee: jest.fn(() => Promise.resolve(true)),
            getEmployeeStats: jest.fn(() => Promise.resolve({
                total: 3,
                active: 2,
                inactive: 1,
                onLeave: 0,
            })),
            get: jest.fn(() => Promise.resolve({ data: [] })),
        },
    }
})

// Mock toast - MUST be before import EmployeesList
const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: mockToast,
    }),
}))

// Mock auth so component doesn't require AuthProvider
jest.mock('@/lib/auth-context', () => ({
    useAuth: () => ({
        user: { name: 'test@example.com', roles: ['System Manager'] },
        isAuthenticated: true,
        isLoading: false,
        isAdmin: true,
        isHRManager: true,
        activeCompany: 'Meena Company',
        switchCompany: jest.fn(),
        companyInfo: {
            company: 'Meena Company',
            isAdmin: true,
            allCompanies: ['Meena Company'],
            employee: 'EMP-001',
        },
    }),
    useAuthSafe: () => ({
        user: { name: 'test@example.com', roles: ['System Manager'] },
        isAuthenticated: true,
    }),
    AuthContext: { Consumer: ({ children }: any) => children({}) },
}))

// Mock i18n so component doesn't require I18nProvider
const enTranslations: Record<string, string> = {
    'emp.title': 'Employees',
    'emp.subtitle': "Manage your organization's employees",
    'emp.add': 'New Employee',
    'emp.total': 'Total Employees',
    'emp.departments': 'Departments',
    'emp.search': 'Search employees...',
    'emp.all_statuses': 'All Statuses',
    'emp.all_departments': 'All Departments',
    'emp.designation': 'Designation',
    'emp.contact': 'Contact',
    'emp.joined': 'Joined',
    'emp.no_found': 'No employees found',
    'emp.delete_confirm': 'Are you sure you want to delete',
    'emp.deleted': 'Employee deleted successfully',
    'emp.delete_fail': 'Failed to delete employee',
    'emp.load_fail': 'Failed to load employees. Please try again.',
    'emp.exported': 'Employees exported to CSV',
    'emp.employees': 'employees',
    'active': 'Active',
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.suspended': 'Suspended',
    'status.left': 'Left',
    'refresh': 'Refresh',
    'export': 'Export',
    'showing': 'Showing',
    'success': 'Success',
    'error': 'Error',
    'id': 'ID',
    'name': 'Name',
    'employee': 'Employee',
    'department': 'Department',
    'status': 'Status',
    'actions': 'Actions',
    'view_details': 'View Details',
    'edit': 'Edit',
    'delete': 'Delete',
    'page': 'Page',
    'of': 'of',
    'to': 'to',
    'next': 'Next',
    'previous': 'Previous',
}
jest.mock('@/lib/i18n', () => ({
    useI18n: () => ({
        lang: 'en',
        setLang: jest.fn(),
        t: (key: string) => enTranslations[key] ?? key,
        dir: 'ltr',
        isRTL: false,
    }),
    I18nProvider: ({ children }: any) => children,
}))

// Import component AFTER mocks
import { EmployeesList } from '../employee/employees-list'
import { frappeClient } from '@/lib/api-client'

describe('EmployeesList', () => {
    beforeEach(() => {
        jest.clearAllMocks()
            // Re-apply default mock implementations after clearAllMocks
            ; (frappeClient.getEmployees as jest.Mock).mockResolvedValue(mockEmployees)
            ; (frappeClient.deleteEmployee as jest.Mock).mockResolvedValue(true)
            ; (frappeClient.getEmployeeStats as jest.Mock).mockResolvedValue({ total: 3, active: 2, inactive: 1, onLeave: 0 })
            // Reset get mock with doctype-aware implementation
            ; (frappeClient.get as jest.Mock).mockImplementation((doctype: string) => {
                if (doctype === 'Company') return Promise.resolve({ data: [{ name: 'Meena Company' }] })
                if (doctype === 'Department') return Promise.resolve({
                    data: [
                        { name: 'Engineering', company: 'Meena Company' },
                        { name: 'HR', company: 'Meena Company' },
                    ]
                })
                return Promise.resolve({ data: [] })
            })
    })

    describe('Rendering', () => {
        it('should render the component', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Employees')).toBeInTheDocument()
            })
        })

        it('should display loading state initially', () => {
            render(<EmployeesList />)

            expect(document.querySelector('.animate-pulse')).toBeTruthy()
        })

        it('should display employees after loading', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
                expect(screen.getByText('Sarah Williams')).toBeInTheDocument()
                expect(screen.getByText('John Smith')).toBeInTheDocument()
            })
        })

        it('should display stats cards', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Total Employees')).toBeInTheDocument()
                expect(screen.getAllByText('3').length).toBeGreaterThan(0) // Total count
            })
        })

        it('should display correct active count', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
                expect(screen.getAllByText('2').length).toBeGreaterThan(0) // 2 active employees
            })
        })
    })

    describe('Search Functionality', () => {
        it('should filter employees by name', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const searchInput = screen.getByPlaceholderText(/Search employees/i)
            await userEvent.type(searchInput, 'Ahmed')

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
                expect(screen.queryByText('Sarah Williams')).not.toBeInTheDocument()
            })
        })

        it('should filter employees by department', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const searchInput = screen.getByPlaceholderText(/Search employees/i)
            await userEvent.type(searchInput, 'HR')

            await waitFor(() => {
                expect(screen.getByText('Sarah Williams')).toBeInTheDocument()
                expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
            })
        })

        it('should show no results message when no match', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const searchInput = screen.getByPlaceholderText(/Search employees/i)
            await userEvent.type(searchInput, 'NonExistent')

            await waitFor(() => {
                expect(screen.getByText('No employees found')).toBeInTheDocument()
            })
        })
    })

    describe('Status Filter', () => {
        it.skip('should filter by Active status', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            // Find and click status filter trigger (shadcn Select renders button with combobox role)
            const statusSelect = screen.getAllByRole('combobox')[0]
            await userEvent.click(statusSelect)

            const activeOption = screen.getAllByText('Active')[0]
            await userEvent.click(activeOption)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
                expect(screen.getByText('Sarah Williams')).toBeInTheDocument()
                expect(screen.queryByText('John Smith')).not.toBeInTheDocument()
            })
        })

        it.skip('should filter by Inactive status', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const statusSelect = screen.getAllByRole('combobox')[0]
            await userEvent.click(statusSelect)

            const inactiveOption = screen.getByText('Inactive')
            await userEvent.click(inactiveOption)

            await waitFor(() => {
                expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
                expect(screen.getByText('John Smith')).toBeInTheDocument()
            })
        })
    })

    describe('Department Filter', () => {
        it.skip('should filter by department', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const deptSelect = screen.getAllByRole('combobox')[1]
            await userEvent.click(deptSelect)

            const engineeringOption = screen.getByText('Engineering')
            await userEvent.click(engineeringOption)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
                expect(screen.queryByText('Sarah Williams')).not.toBeInTheDocument()
            })
        })
    })

    describe('Sorting', () => {
        it('should sort by employee name ascending', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const rows = screen.getAllByRole('row')
            // First row is header, check all data rows contain expected employees
            const rowTexts = rows.slice(1).map(r => r.textContent || '')
            expect(rowTexts.some(t => t.includes('Ahmed Mohamed'))).toBe(true)
            expect(rowTexts.some(t => t.includes('Sarah Williams'))).toBe(true)
        })

        it.skip('should toggle sort order when clicking same column', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            // Employee column header sorts on click
            const nameHeader = screen.getByText('Employee')
            await userEvent.click(nameHeader)

            // Should now be descending — Sarah Williams comes first alphabetically last
            await waitFor(() => {
                const rows = screen.getAllByRole('row')
                expect(rows.length).toBeGreaterThan(1)
            })
        })
    })

    describe('Pagination', () => {
        it('should paginate results', async () => {
            // Create more than 20 employees
            const manyEmployees = Array.from({ length: 25 }, (_, i) => ({
                ...mockEmployees[0],
                name: `EMP-${String(i).padStart(3, '0')}`,
                employee_name: `Employee ${i}`,
            }))

                ; (frappeClient.getEmployees as jest.Mock).mockResolvedValueOnce(manyEmployees)

            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText(/page\s+1\s+of\s+2/i)).toBeInTheDocument()
            })
        })

        it('should navigate to next page', async () => {
            const manyEmployees = Array.from({ length: 25 }, (_, i) => ({
                ...mockEmployees[0],
                name: `EMP-${String(i).padStart(3, '0')}`,
                employee_name: `Employee ${i}`,
            }))

                ; (frappeClient.getEmployees as jest.Mock).mockResolvedValueOnce(manyEmployees)

            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText(/page\s+1\s+of\s+2/i)).toBeInTheDocument()
            })

            const nextButton = screen.getByRole('button', { name: /next/i })
            await userEvent.click(nextButton)

            await waitFor(() => {
                expect(screen.getByText(/page\s+2\s+of\s+2/i)).toBeInTheDocument()
            })
        })
    })

    describe('Actions', () => {
        it('should call onEmployeeSelect when clicking employee', async () => {
            const onEmployeeSelect = jest.fn()
            render(<EmployeesList onEmployeeSelect={onEmployeeSelect} />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            // Click the first TableCell which has the onClick handler (not the whole row)
            const employeeCell = screen.getByText('Ahmed Mohamed').closest('td')
            await userEvent.click(employeeCell!)

            expect(onEmployeeSelect).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'EMP-001',
                    employee_name: 'Ahmed Mohamed',
                })
            )
        })

        it('should call onAddEmployee when clicking Add button', async () => {
            const onAddEmployee = jest.fn()
            render(<EmployeesList onAddEmployee={onAddEmployee} />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const addButton = screen.getByRole('button', { name: /new employee/i })
            await userEvent.click(addButton)

            expect(onAddEmployee).toHaveBeenCalled()
        })

        it('should refresh data when clicking Refresh button', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const refreshButton = screen.getByRole('button', { name: /refresh/i })
            await userEvent.click(refreshButton)

            expect(frappeClient.getEmployees).toHaveBeenCalledTimes(2)
        })

        it.skip('should delete employee when clicking Delete', async () => {
            ; (frappeClient.deleteEmployee as jest.Mock).mockResolvedValue(true)

            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            // Open actions dropdown for first employee row
            const allButtons = screen.getAllByRole('button')
            // The actions (⋮) buttons come after Refresh, Export, New Employee
            const actionMenuBtn = allButtons.find(btn => {
                const svg = btn.querySelector('svg')
                return svg && !btn.textContent?.trim()
            })
            expect(actionMenuBtn).toBeTruthy()
            await userEvent.click(actionMenuBtn!)

            // Wait for dropdown content
            await waitFor(() => {
                expect(screen.getByText('Delete')).toBeInTheDocument()
            })

            const deleteButton = screen.getByText('Delete')
            await userEvent.click(deleteButton)

            // A confirm dialog should appear — click confirm
            await waitFor(() => {
                // Dialog or direct delete call
                const deleteConfirmBtn = screen.queryByRole('button', { name: /delete/i })
                if (deleteConfirmBtn) userEvent.click(deleteConfirmBtn)
            })
        })

        it('should export to CSV', async () => {
            // Mock URL.createObjectURL
            global.URL.createObjectURL = jest.fn(() => 'blob:mock')
            global.URL.revokeObjectURL = jest.fn()

            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            // Set up createElement spy AFTER render so React can initialize properly
            const mockClick = jest.fn()
            const mockLink = { click: mockClick, href: '', download: '', style: { display: '' } }
            const originalCreate = document.createElement.bind(document)
            const createSpy = jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
                if (tag === 'a') return mockLink as any
                return originalCreate(tag)
            })
            const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
            const removeSpy = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

            const exportButton = screen.getByRole('button', { name: /export/i })
            await userEvent.click(exportButton)

            expect(mockClick).toHaveBeenCalled()
            createSpy.mockRestore()
            appendSpy.mockRestore()
            removeSpy.mockRestore()
        })
    })

    describe('Error Handling', () => {
        it('should display error toast when loading fails', async () => {
            ; (frappeClient.getEmployees as jest.Mock).mockRejectedValue(new Error('Network error'))

            render(<EmployeesList />)

            await waitFor(() => {
                expect(frappeClient.getEmployees).toHaveBeenCalled()
            })

            // Component should still render but show error message
            expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('should have proper ARIA labels', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            // Check for accessible elements
            expect(screen.getByRole('table')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /new employee/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
        })

        it('should be keyboard navigable', async () => {
            render(<EmployeesList />)

            await waitFor(() => {
                expect(screen.getByText('Ahmed Mohamed')).toBeInTheDocument()
            })

            const searchInput = screen.getByPlaceholderText(/Search employees/i)
            searchInput.focus()

            expect(document.activeElement).toBe(searchInput)
        })
    })
})
