/**
 * Self-Service Profile Component Tests
 * Tests for employee self-service profile viewing and editing
 */

import '@testing-library/jest-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock employee data
const mockEmployee = {
    name: 'HR-EMP-00001',
    employee_name: 'أحمد محمد',
    first_name: 'أحمد',
    middle_name: '',
    last_name: 'محمد',
    gender: 'Male',
    date_of_birth: '1990-05-15',
    date_of_joining: '2024-01-15',
    company: 'شركة ميناء',
    department: 'الهندسة - شركة ميناء',
    designation: 'مطور أول',
    branch: 'الرياض',
    status: 'Active',
    cell_number: '+966501234567',
    personal_email: 'ahmed.personal@gmail.com',
    company_email: 'ahmed@meena.sa',
    user_id: 'ahmed@meena.sa',
    image: '/files/ahmed.jpg',
    default_shift: 'صباحي',
    employment_type: 'Full-time',
    custom_national_id: '1234567890',
    custom_id_type: 'National ID',
}

// Mock frappeClient
const mockGetList = jest.fn()
const mockUpdateEmployee = jest.fn()

jest.mock('@/lib/api-client', () => ({
    frappeClient: {
        getList: (...args: any[]) => mockGetList(...args),
        updateEmployee: (...args: any[]) => mockUpdateEmployee(...args),
        call: jest.fn(() => Promise.resolve({ message: [] })),
    },
}))

// Mock api
jest.mock('@/lib/api', () => ({
    updateDoc: jest.fn(() => Promise.resolve({})),
}))

// Mock utils
jest.mock('@/lib/utils', () => ({
    frappeImageUrl: (url: string) => url ? `https://test.com${url}` : '',
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// Mock i18n context.
// `t` resolves through the REAL dictionary rather than echoing the key back: the
// assertions below check the actual Arabic labels, and a key-echoing stub would only
// ever prove that the stub works. Arabic is the provider's own default.
jest.mock('@/lib/i18n', () => {
    const { translate } = jest.requireActual('@/lib/i18n')
    return {
        useI18n: () => ({
            t: (key: string) => translate(key, 'ar'),
            lang: 'ar' as const,
            setLang: jest.fn(),
            isRTL: true,
            locale: 'ar',
            dir: 'rtl' as const,
        }),
        I18nProvider: ({ children }: { children: React.ReactNode }) => children,
    }
})

// Mock auth context
const mockRefreshUser = jest.fn()
jest.mock('@/lib/auth-context', () => ({
    useAuthSafe: () => ({
        user: { email: 'ahmed@meena.sa', full_name: 'أحمد محمد', roles: ['Employee'] },
        isAuthenticated: true,
        refreshUser: mockRefreshUser,
    }),
}))

// Mock employee-documents component (complex Radix/hook dependencies
// cause useState to fail in next/jest test environment)
jest.mock('@/components/employee/employee-documents', () => ({
    EmployeeDocuments: () => null,
}))

// Import after mocks
import { SelfServiceProfile } from '../self-service-profile'

describe('SelfServiceProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetList.mockResolvedValue([mockEmployee])
        mockUpdateEmployee.mockResolvedValue(mockEmployee)
        // Mock fetch for image upload
        global.fetch = jest.fn()
    })

    describe('Loading State', () => {
        it('should show loading spinner initially', () => {
            // Make getList hang
            mockGetList.mockReturnValue(new Promise(() => { }))
            render(<SelfServiceProfile />)
            expect(screen.getByText('جاري تحميل الملف الشخصي...')).toBeInTheDocument()
        })
    })

    describe('Error State', () => {
        it('degrades to the account-only view when no employee is linked', async () => {
            // Having no Employee record stopped being an error: a Company Admin or
            // operator who never onboarded gets a read-only account view instead of a
            // dead-end error screen. Only a real load FAILURE still shows the error.
            mockGetList.mockResolvedValue([])
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('لا يوجد ملف موظف مرتبط بهذا الحساب.')).toBeInTheDocument()
            })
        })

        it('should show error on API failure', async () => {
            mockGetList.mockRejectedValue(new Error('Network error'))
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('حدث خطأ أثناء تحميل البيانات')).toBeInTheDocument()
            })
        })
    })

    describe('Profile Display', () => {
        it('should display employee name and designation', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            // Designation appears in header and info section
            expect(screen.getAllByText('مطور أول').length).toBeGreaterThanOrEqual(1)
        })

        it('should display employee ID', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('HR-EMP-00001')).toBeInTheDocument()
            })
        })

        it('should display contact info', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('+966501234567')).toBeInTheDocument()
                expect(screen.getByText('ahmed.personal@gmail.com')).toBeInTheDocument()
            })
        })

        it('should display national ID info', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('1234567890')).toBeInTheDocument()
                expect(screen.getByText('هوية وطنية')).toBeInTheDocument()
            })
        })

        it('should display company info as read-only', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('شركة ميناء')).toBeInTheDocument()
                expect(screen.getByText('الهندسة')).toBeInTheDocument()
                expect(screen.getByText('الرياض')).toBeInTheDocument()
            })
        })

        it('should display active status badge', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('نشط')).toBeInTheDocument()
            })
        })

        it('should display default shift', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('صباحي')).toBeInTheDocument()
            })
        })

        it('should show back button when onBack is provided', async () => {
            const mockOnBack = jest.fn()
            render(<SelfServiceProfile onBack={mockOnBack} />)

            await waitFor(() => {
                expect(screen.getByText('ملفي الشخصي')).toBeInTheDocument()
            })
        })
    })

    describe('API Query', () => {
        it('should query Employee by user_id with correct fields', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(mockGetList).toHaveBeenCalledWith('Employee', expect.objectContaining({
                    filters: [['Employee', 'user_id', '=', 'ahmed@meena.sa']],
                    fields: expect.arrayContaining([
                        'name', 'employee_name', 'cell_number', 'personal_email',
                        'custom_national_id', 'custom_id_type', 'employment_type',
                        'image', 'default_shift',
                    ]),
                    limit_page_length: 1,
                }))
            })
        })

        it('should fallback to company_email if user_id returns empty', async () => {
            mockGetList
                .mockResolvedValueOnce([])       // first call: user_id => empty
                .mockResolvedValueOnce([mockEmployee]) // second call: company_email => found

            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(mockGetList).toHaveBeenCalledTimes(2)
                expect(mockGetList).toHaveBeenLastCalledWith('Employee', expect.objectContaining({
                    filters: [['Employee', 'company_email', '=', 'ahmed@meena.sa']],
                }))
            })

            // Should still render employee
            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })
        })
    })

    describe('Edit Mode', () => {
        it('should enter edit mode when تعديل button is clicked', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            // Should show save/cancel buttons
            expect(screen.getByText('حفظ')).toBeInTheDocument()
            expect(screen.getByText('إلغاء')).toBeInTheDocument()
        })

        it('should show input fields when editing', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            // Phone and email inputs should be present
            const phoneInput = screen.getByPlaceholderText('+966 5xx xxx xxxx')
            expect(phoneInput).toBeInTheDocument()
            expect(phoneInput).toHaveValue('+966501234567')

            const emailInput = screen.getByPlaceholderText('name@email.com')
            expect(emailInput).toBeInTheDocument()
            expect(emailInput).toHaveValue('ahmed.personal@gmail.com')
        })

        it('should cancel editing and restore original values', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            // Change phone number
            const phoneInput = screen.getByPlaceholderText('+966 5xx xxx xxxx')
            await userEvent.clear(phoneInput)
            await userEvent.type(phoneInput, '+966509999999')

            // Cancel
            fireEvent.click(screen.getByText('إلغاء'))

            // Should show original number
            expect(screen.getByText('+966501234567')).toBeInTheDocument()
        })
    })

    describe('Save Functionality', () => {
        it('should save updated contact info', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            // Change phone number
            const phoneInput = screen.getByPlaceholderText('+966 5xx xxx xxxx')
            await userEvent.clear(phoneInput)
            await userEvent.type(phoneInput, '+966509999999')

            // Save
            fireEvent.click(screen.getByText('حفظ'))

            await waitFor(() => {
                expect(mockUpdateEmployee).toHaveBeenCalledWith('HR-EMP-00001', expect.objectContaining({
                    cell_number: '+966509999999',
                }))
            })
        })

        it('should show success message after save', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            const phoneInput = screen.getByPlaceholderText('+966 5xx xxx xxxx')
            await userEvent.clear(phoneInput)
            await userEvent.type(phoneInput, '+966509999999')

            fireEvent.click(screen.getByText('حفظ'))

            await waitFor(() => {
                expect(screen.getByText('تم تحديث البيانات بنجاح ✅')).toBeInTheDocument()
            })
        })

        it('should show "no changes" when nothing modified', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))
            fireEvent.click(screen.getByText('حفظ'))

            await waitFor(() => {
                expect(screen.getByText('لا توجد تغييرات للحفظ')).toBeInTheDocument()
            })
            expect(mockUpdateEmployee).not.toHaveBeenCalled()
        })

        it('should show error message on save failure', async () => {
            mockUpdateEmployee.mockRejectedValueOnce(new Error('Permission denied'))
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            const phoneInput = screen.getByPlaceholderText('+966 5xx xxx xxxx')
            await userEvent.clear(phoneInput)
            await userEvent.type(phoneInput, '+966500000000')

            fireEvent.click(screen.getByText('حفظ'))

            await waitFor(() => {
                expect(screen.getByText(/حدث خطأ أثناء الحفظ/)).toBeInTheDocument()
            })
        })

        it('should save national ID and ID type', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            // Change national ID
            const idInput = screen.getByPlaceholderText('أدخل رقم الهوية')
            await userEvent.clear(idInput)
            await userEvent.type(idInput, '9876543210')

            fireEvent.click(screen.getByText('حفظ'))

            await waitFor(() => {
                expect(mockUpdateEmployee).toHaveBeenCalledWith('HR-EMP-00001', expect.objectContaining({
                    custom_national_id: '9876543210',
                }))
            })
        })

        it('should only include changed fields in update', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            // Only change email
            const emailInput = screen.getByPlaceholderText('name@email.com')
            await userEvent.clear(emailInput)
            await userEvent.type(emailInput, 'newemail@gmail.com')

            fireEvent.click(screen.getByText('حفظ'))

            await waitFor(() => {
                expect(mockUpdateEmployee).toHaveBeenCalledWith('HR-EMP-00001', {
                    personal_email: 'newemail@gmail.com',
                })
            })
        })
    })

    describe('Image Upload', () => {
        it('should trigger file input when camera button clicked', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            // There should be a hidden file input
            const fileInput = document.querySelector('input[type="file"]')
            expect(fileInput).toBeInTheDocument()
            expect(fileInput).toHaveAttribute('accept', 'image/*')
        })

        it('should reject images larger than 2MB', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
            Object.defineProperty(largeFile, 'size', { value: 3 * 1024 * 1024 })

            fireEvent.change(fileInput, { target: { files: [largeFile] } })

            await waitFor(() => {
                expect(screen.getByText('حجم الصورة يجب أن يكون أقل من 2 ميجابايت')).toBeInTheDocument()
            })
        })
    })

    describe('Inactive Employee Status', () => {
        it('should display inactive status correctly', async () => {
            mockGetList.mockResolvedValue([{ ...mockEmployee, status: 'Left' }])
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('غادر')).toBeInTheDocument()
            })
        })
    })

    describe('National ID Validation', () => {
        it('should show validation warning for invalid ID length', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            const idInput = screen.getByPlaceholderText('أدخل رقم الهوية')
            await userEvent.clear(idInput)
            await userEvent.type(idInput, '12345')

            expect(screen.getByText('⚠️ رقم الهوية يجب أن يكون 10 أرقام')).toBeInTheDocument()
        })

        it('should not show warning for valid 10-digit ID', async () => {
            render(<SelfServiceProfile />)

            await waitFor(() => {
                expect(screen.getByText('أحمد محمد')).toBeInTheDocument()
            })

            fireEvent.click(screen.getByText('تعديل'))

            const idInput = screen.getByPlaceholderText('أدخل رقم الهوية')
            await userEvent.clear(idInput)
            await userEvent.type(idInput, '1234567890')

            expect(screen.queryByText('⚠️ رقم الهوية يجب أن يكون 10 أرقام')).not.toBeInTheDocument()
        })
    })
})
