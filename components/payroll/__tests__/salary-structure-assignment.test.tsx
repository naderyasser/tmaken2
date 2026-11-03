import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SalaryStructureAssignment } from '@/components/payroll/salary-structure-assignment'
import { frappeClient } from '@/lib/api-client'
import React from 'react'

const toastMock = jest.fn()

jest.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e: any) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}))

jest.mock('@/lib/api-client', () => ({
  frappeClient: {
    getSalaryStructureAssignments: jest.fn(),
    getEmployees: jest.fn(),
    getSalaryStructures: jest.fn(),
    getSalaryComponent: jest.fn(),
    createSalaryComponent: jest.fn(),
    createSalaryStructure: jest.fn(),
    createSalaryStructureAssignment: jest.fn(),
    updateSalaryStructureAssignment: jest.fn(),
    deleteSalaryStructureAssignment: jest.fn(),
    get: jest.fn(),
    call: jest.fn(),
  },
}))

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
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

describe('SalaryStructureAssignment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // clearAllMocks clears calls but keeps implementations, so a test that makes
    // `call` reject would leak that into every test after it.
    ; (frappeClient.call as any).mockReset()
    Element.prototype.scrollIntoView = jest.fn()
      ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValue([
        {
          name: 'SSA-0001',
          employee: 'EMP-0001',
          employee_name: 'Ahmed Ali',
          salary_structure: 'Default Structure',
          from_date: '2026-02-01',
          base: 0,
        },
      ])
      ; (frappeClient.getEmployees as any).mockResolvedValue([
        { name: 'EMP-0001', employee_name: 'Ahmed Ali', company: 'My Company' },
      ])
      ; (frappeClient.getSalaryStructures as any).mockResolvedValue([
        { name: 'Default Structure', company: 'My Company', is_active: 'Yes' },
      ])
      // Salary Structure.is_active is a Select ("Yes"/"No"), never 0/1.
      ; (frappeClient.get as any).mockImplementation((doctype: string, name: string) => {
        if (doctype === 'Company') {
          return Promise.resolve({ data: { name, default_currency: 'SAR' } })
        }
        return Promise.resolve({ data: { name, doctype, docstatus: 1 } })
      })
  })

  it('loads assignments with required backend fields', async () => {
    render(<SalaryStructureAssignment />)

    await waitFor(() => {
      expect(frappeClient.getSalaryStructureAssignments).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: ['name', 'employee', 'employee_name', 'salary_structure', 'from_date', 'base', 'docstatus'],
          order_by: 'creation desc',
        })
      )
    })
  })

  it('renders employee and base salary including zero value', async () => {
    render(<SalaryStructureAssignment />)

    await waitFor(() => {
      expect(screen.getByText('Ahmed Ali')).toBeInTheDocument()
      // Base salary now renders through the canonical formatter → "0 ر.س"
      expect(screen.getByText('0 ر.س')).toBeInTheDocument()
    })
  })

  it('does not render Invalid Date when date is missing/invalid', async () => {
    ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValueOnce([
      {
        name: 'SSA-0002',
        employee: 'EMP-0002',
        employee_name: 'Sara',
        from_date: '',
      },
    ])

    render(<SalaryStructureAssignment />)

    await waitFor(() => {
      expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })
  })

  it('validates required fields before assigning', async () => {
    render(<SalaryStructureAssignment />)

    await waitFor(() => {
      expect(screen.getByText('pay.ssa.title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByText('pay.ssa.assign')[0])
    fireEvent.click(screen.getAllByText('pay.ssa.assign')[1])

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'pay.ssa.required_fields', variant: 'destructive' })
    )
    expect(frappeClient.createSalaryStructureAssignment).not.toHaveBeenCalled()
  })

  it('edits an existing fixed salary assignment', async () => {
    ; (frappeClient.createSalaryStructureAssignment as any).mockResolvedValue({ name: 'SSA-NEW-001' })

    render(<SalaryStructureAssignment />)

    await waitFor(() => {
      expect(screen.getByText('Ahmed Ali')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('pay.ssa.edit'))

    await waitFor(() => {
      expect(screen.getByText('pay.ssa.edit_title')).toBeInTheDocument()
    })

    const baseInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(baseInput, { target: { value: '4500' } })

    fireEvent.click(screen.getByText('pay.ssa.save'))

    await waitFor(() => {
      expect(frappeClient.call).toHaveBeenCalledWith(
        'frappe.client.cancel',
        { doctype: 'Salary Structure Assignment', name: 'SSA-0001' }
      )
    })

    await waitFor(() => {
      expect(frappeClient.createSalaryStructureAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          employee: 'EMP-0001',
          salary_structure: 'Default Structure',
          base: 4500,
        })
      )
    })
  })

  it('deletes an existing fixed salary assignment', async () => {
    ; (frappeClient.deleteSalaryStructureAssignment as any).mockResolvedValue(undefined)

    render(<SalaryStructureAssignment />)

    await waitFor(() => {
      expect(screen.getByLabelText('pay.ssa.delete')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('pay.ssa.delete'))

    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => {
      expect(frappeClient.call).toHaveBeenCalledWith(
        'frappe.client.cancel',
        { doctype: 'Salary Structure Assignment', name: 'SSA-0001' }
      )
    })

    await waitFor(() => {
      expect(frappeClient.deleteSalaryStructureAssignment).toHaveBeenCalledWith('SSA-0001')
    })
  })

  it('submits the new assignment — a draft is invisible to payroll', async () => {
    ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValue([])
    ; (frappeClient.createSalaryStructureAssignment as any).mockResolvedValue({ name: 'SSA-NEW-001' })

    render(<SalaryStructureAssignment />)
    await waitFor(() => expect(screen.getByText('pay.ssa.title')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('pay.ssa.assign')[0])
    await waitFor(() => expect(screen.getByText('pay.ssa.assign_title')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: 'EMP-0001' } })
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '5000' } })

    const assignButtons = screen.getAllByText('pay.ssa.assign')
    fireEvent.click(assignButtons[assignButtons.length - 1])

    await waitFor(() => {
      expect(frappeClient.call).toHaveBeenCalledWith(
        'frappe.client.submit',
        expect.objectContaining({
          doc: expect.objectContaining({ doctype: 'Salary Structure Assignment', name: 'SSA-NEW-001' }),
        })
      )
    })
  })

  it('reports a failed submit instead of claiming the salary was assigned', async () => {
    ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValue([])
    ; (frappeClient.createSalaryStructureAssignment as any).mockResolvedValue({ name: 'SSA-NEW-002' })
    ; (frappeClient.call as any).mockImplementation((method: string) =>
      method === 'frappe.client.submit'
        ? Promise.reject(new Error('Not allowed to submit'))
        : Promise.resolve({})
    )

    render(<SalaryStructureAssignment />)
    await waitFor(() => expect(screen.getByText('pay.ssa.title')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('pay.ssa.assign')[0])
    await waitFor(() => expect(screen.getByText('pay.ssa.assign_title')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: 'EMP-0001' } })
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '5000' } })

    const assignButtons = screen.getAllByText('pay.ssa.assign')
    fireEvent.click(assignButtons[assignButtons.length - 1])

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'pay.ssa.assign_fail', variant: 'destructive' })
      )
    })
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'pay.ssa.assigned' }))
  })

  it('only ever cancels a submitted assignment — a cancelled row must not shadow it', async () => {
    ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValue([])
    ; (frappeClient.createSalaryStructureAssignment as any).mockResolvedValue({ name: 'SSA-NEW-003' })

    render(<SalaryStructureAssignment />)
    await waitFor(() => expect(screen.getByText('pay.ssa.title')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('pay.ssa.assign')[0])
    await waitFor(() => expect(screen.getByText('pay.ssa.assign_title')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: 'EMP-0001' } })
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '5000' } })

    const assignButtons = screen.getAllByText('pay.ssa.assign')
    fireEvent.click(assignButtons[assignButtons.length - 1])

    await waitFor(() => {
      expect(frappeClient.getSalaryStructureAssignments).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            ['Salary Structure Assignment', 'employee', '=', 'EMP-0001'],
            ['Salary Structure Assignment', 'docstatus', '=', 1],
          ]),
        })
      )
    })
  })

  it('auto-creates default salary structure when none exists and assigns salary', async () => {
    ; (frappeClient.getSalaryStructureAssignments as any).mockResolvedValue([])
    ; (frappeClient.getSalaryStructures as any).mockResolvedValue([])
    ; (frappeClient.getSalaryComponent as any).mockRejectedValueOnce(new Error('Not found'))
    ; (frappeClient.createSalaryComponent as any).mockResolvedValue({ name: 'Basic Salary' })
    ; (frappeClient.createSalaryStructure as any).mockResolvedValue({
      name: 'Auto Structure',
      company: 'My Company',
    })
    ; (frappeClient.createSalaryStructureAssignment as any).mockResolvedValue({
      name: 'SSA-AUTO-001',
    })

    render(<SalaryStructureAssignment />)

    await waitFor(() => {
      expect(screen.getByText('pay.ssa.title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByText('pay.ssa.assign')[0])

    await waitFor(() => {
      expect(screen.getByText('pay.ssa.assign_title')).toBeInTheDocument()
    })

    const select = screen.getByTestId('mock-select')
    fireEvent.change(select, { target: { value: 'EMP-0001' } })

    const baseInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(baseInput, { target: { value: '5000' } })

    const dialogAssignButtons = screen.getAllByText('pay.ssa.assign')
    fireEvent.click(dialogAssignButtons[dialogAssignButtons.length - 1])

    await waitFor(() => {
      expect(frappeClient.createSalaryComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          salary_component: 'Basic Salary',
          type: 'Earning',
        })
      )
    }, { timeout: 5000 })

    await waitFor(() => {
      expect(frappeClient.createSalaryStructure).toHaveBeenCalledWith(
        expect.objectContaining({
          payroll_frequency: 'Monthly',
          is_active: 'Yes',
          earnings: [{ salary_component: 'Basic Salary' }],
          company: 'My Company',
          currency: 'SAR',
        })
      )
    })

    await waitFor(() => {
      expect(frappeClient.createSalaryStructureAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          employee: 'EMP-0001',
          base: 5000,
        })
      )
    })
  })
})
