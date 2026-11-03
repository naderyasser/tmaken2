/**
 * API Client Tests
 * Integration tests for Frappe API Client
 */

import { FrappeAPIClient } from '../api-client'

describe('FrappeAPIClient', () => {
    let client: FrappeAPIClient

    beforeEach(() => {
        client = new FrappeAPIClient('https://qarawi.base.meena.sa')
        // Clear any stored auth
        client.clearAuth()
            // Pre-set CSRF token so ensureCsrfToken() is a no-op and doesn't consume mocks
            ; (client as any).csrfToken = 'mock-csrf-token'

        // Mock fetch
        global.fetch = jest.fn()
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('Authentication', () => {
        it('should login successfully', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ success: true, message: 'Logged in' }),
            }
            const mockCsrfResponse = {
                ok: true,
                json: async () => ({ message: 'test-csrf-token' }),
            }
                ; (global.fetch as jest.Mock)
                    .mockResolvedValueOnce(mockResponse)
                    .mockResolvedValueOnce(mockCsrfResponse)

            const result = await client.login('test@example.com', 'password')

            expect(result.success).toBe(true)
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/method/login'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        usr: 'test@example.com',
                        pwd: 'password',
                    }),
                })
            )
        })

        it('should handle login failure', async () => {
            const mockResponse = {
                ok: false,
                json: async () => ({ success: false }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const result = await client.login('wrong@example.com', 'wrong')

            expect(result.success).toBe(false)
        })

        it('should set token', () => {
            client.setToken('test-token-123')
            expect((client as any)._token).toBe('test-token-123')
        })

        it('should set API credentials', () => {
            client.setAPICredentials('api-key', 'api-secret')
            expect((client as any)._apiKey).toBe('api-key')
            expect((client as any)._apiSecret).toBe('api-secret')
        })

        it('should clear authentication', () => {
            client.setToken('test-token')
            client.clearAuth()
            expect((client as any)._token).toBeNull()
        })
    })

    describe('GET Requests', () => {
        it('should get list of employees', async () => {
            const mockEmployees = {
                data: [
                    { name: 'EMP-001', employee_name: 'John Doe', status: 'Active' },
                    { name: 'EMP-002', employee_name: 'Jane Smith', status: 'Active' },
                ],
            }

            const mockResponse = {
                ok: true,
                json: async () => mockEmployees,
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const employees = await client.getEmployees()

            expect(employees).toHaveLength(2)
            expect(employees[0].employee_name).toBe('John Doe')
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('Employee'),
                expect.any(Object)
            )
        })

        it('should get single employee', async () => {
            const mockEmployee = {
                data: {
                    name: 'EMP-001',
                    employee_name: 'John Doe',
                    department: 'Engineering',
                    status: 'Active',
                },
            }

            const mockResponse = {
                ok: true,
                json: async () => mockEmployee,
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const employee = await client.getEmployee('EMP-001')

            expect(employee).not.toBeNull()
            expect(employee?.employee_name).toBe('John Doe')
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('Employee'),
                expect.any(Object)
            )
        })

        it('should apply filters correctly', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ data: [] }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            await client.getEmployees({
                filters: [['Employee', 'status', '=', 'Active']],
                limit_page_length: 50,
            })

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('Employee'),
                expect.any(Object)
            )
        })
    })

    describe('POST Requests', () => {
        it('should create new employee', async () => {
            const newEmployee = {
                employee_name: 'Ahmed Mohamed',
                company: 'Meena Company',
                status: 'Active' as const,
            }

            const mockResponse = {
                ok: true,
                json: async () => ({ data: { name: 'EMP-003', ...newEmployee } }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const created = await client.createEmployee(newEmployee)

            expect(created).not.toBeNull()
            expect(created?.employee_name).toBe('Ahmed Mohamed')
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/resource/Employee'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(newEmployee),
                })
            )
        })

        it('should mark attendance', async () => {
            const attendance = {
                employee: 'EMP-001',
                attendance_date: '2026-02-07',
                status: 'Present' as const,
            }

            const mockResponse = {
                ok: true,
                json: async () => ({ data: { name: 'ATT-001', ...attendance } }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const result = await client.markAttendance(attendance)

            expect(result).not.toBeNull()
            expect(result?.status).toBe('Present')
        })
    })

    describe('PUT Requests', () => {
        it('should update employee', async () => {
            const updates = {
                department: 'Sales',
                designation: 'Senior Manager',
            }

            const mockResponse = {
                ok: true,
                json: async () => ({ data: { name: 'EMP-001', ...updates } }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const updated = await client.updateEmployee('EMP-001', updates)

            expect(updated).not.toBeNull()
            expect(updated?.department).toBe('Sales')
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('Employee'),
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(updates),
                })
            )
        })
    })

    describe('DELETE Requests', () => {
        it('should delete employee', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ message: 'ok' }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const result = await client.deleteEmployee('EMP-001')

            expect(result).toBe(true)
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('Employee'),
                expect.objectContaining({
                    method: 'DELETE',
                })
            )
        })

        it('should handle delete error', async () => {
            const mockResponse = {
                ok: false,
                json: async () => ({ error: 'Not found' }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const result = await client.deleteEmployee('INVALID')

            expect(result).toBe(false)
        })
    })

    describe('Search', () => {
        it('should search employees via the comprehensive search endpoint', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    message: [
                        { name: 'EMP-001', employee_name: 'Ahmed Mohamed' },
                    ],
                }),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            const results = await client.searchEmployees('Ahmed')

            expect(results).toHaveLength(1)
            expect(results[0].employee_name).toBe('Ahmed Mohamed')
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('base_meena.employee_search_api.search_employees'),
                expect.any(Object)
            )
        })
    })

    describe('Error Handling', () => {
        it('should handle network errors', async () => {
            ; (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

            await expect(client.getEmployees()).rejects.toThrow('Network error')
        })

        it('should handle HTTP errors', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                json: async () => ({}),
            }
                ; (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

            await expect(client.getEmployee('INVALID')).rejects.toThrow('404')
        })
    })

    describe('Stats Methods', () => {
        it('should get employee stats from Employee + today\'s Attendance', async () => {
            // Two round-trips, in order: active employees, then today's attendance.
            const employees = { ok: true, json: async () => ({ data: [{ name: 'HR-EMP-1' }, { name: 'HR-EMP-2' }] }) }
            const attendance = {
                ok: true,
                json: async () => ({
                    data: [
                        { name: 'ATT-1', status: 'Present' },
                        { name: 'ATT-2', status: 'On Leave' },
                    ],
                }),
            }
                ; (global.fetch as jest.Mock)
                    .mockResolvedValueOnce(employees)
                    .mockResolvedValueOnce(attendance)

            const stats = await client.getEmployeeStats()

            expect(stats.total).toBe(2)
            expect(stats.present).toBe(1)
            expect(stats.on_leave).toBe(1)
            expect(stats.absent).toBe(0)
        })
    })
})
