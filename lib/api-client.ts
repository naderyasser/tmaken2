/**
 * Frappe API Client - TypeScript
 * Complete integration with Frappe/ERPNext Backend
 * 
 * This client makes direct API calls to the Frappe backend
 * since the frontend and backend are on the same domain.
 */

// Shared with lib/api.ts so both request layers decode Frappe errors identically.
import { stripExceptionClass } from './frappe-error'

// Helper function to make requests to Frappe backend.
// In development (NEXT_PUBLIC_FRAPPE_URL is set in .env.local), route through
// /api/frappe proxy so Set-Cookie headers are sanitized (Domain/Secure stripped)
// before reaching the browser — otherwise cookies from qarawi.base.meena.sa
// are rejected by the browser when running on localhost.
// In production the frontend and backend share the same domain, so direct paths work.
/**
 * Canonical URL builder for a raw Frappe REST path — THE one place that knows
 * whether to route via the /api/frappe Next proxy.
 *  - DEV (NEXT_PUBLIC_FRAPPE_URL set): use the proxy so Set-Cookie is
 *    sanitized for localhost.
 *  - PROD: return the path unchanged. nginx maps /api/* straight to Frappe,
 *    so the /api/frappe Next route is UNREACHABLE in prod — components that
 *    hardcoded the proxy 404'd silently (HR-team, uploads, user-creation…).
 * Always build Frappe URLs through this helper, never the proxy literal.
 */
export const frappeApiUrl = (path: string): string =>
    process.env.NEXT_PUBLIC_FRAPPE_URL ? `/api/frappe?path=${encodeURIComponent(path)}` : path

/**
 * True when a Frappe request was refused for lack of authorization: no valid
 * session (401/403 as Guest) or a missing doctype/method permission. Screens
 * hand such errors to <SessionRenew /> (components/login-page.tsx), which
 * reopens the walkthrough session when the session is what died, and says
 * "no permission" otherwise — instead of an error toast + console spam.
 */
export const isAuthError = (e: unknown): boolean => {
    const status = (e as { status?: number } | null)?.status
    if (status === 401 || status === 403) return true
    const msg = e instanceof Error ? e.message : String(e ?? '')
    return (
        /HTTP (401|403)/.test(msg) ||
        /PermissionError/i.test(msg) ||
        /not permitted/i.test(msg) ||
        /login to access/i.test(msg) ||
        /not whitelisted/i.test(msg)
    )
}

/** Attach HTTP status to thrown API errors so callers can branch on 401/403. */
const authError = (status: number, message: string): Error => {
    const err = new Error(message) as Error & { status?: number }
    err.status = status
    return err
}

const makeDirectRequest = async (path: string, options: RequestInit = {}): Promise<Response> => {
    return fetch(frappeApiUrl(path), {
        ...options,
        credentials: 'include',
    })
}

// ==================== Types ====================

export interface FrappeResponse<T = any> {
    data?: T
    message?: T
    exc?: string
    _server_messages?: string
}

export interface FrappeListResponse<T> {
    data: T[]
}

export interface Employee {
    name: string
    employee_name: string
    employee_number?: string
    first_name?: string
    middle_name?: string
    last_name?: string
    department?: string
    designation?: string
    company?: string
    status: 'Active' | 'Inactive' | 'Suspended' | 'Left'
    date_of_joining?: string
    date_of_birth?: string
    gender?: 'Male' | 'Female' | 'Other'
    company_email?: string
    personal_email?: string
    cell_number?: string
    image?: string
    reports_to?: string
    branch?: string
    user_id?: string
    default_shift?: string
    custom_employment_mode?: string
    custom_national_id?: string
    custom_id_type?: string
    custom_id_issue_date?: string
    custom_id_expiry_date?: string
    custom_gosi_registration_status?: string
    custom_nationality?: string
    current_address?: string
    permanent_address?: string
    person_to_be_contacted?: string
    relation?: string
    emergency_phone_number?: string
    custom_arrival_date?: string
    custom_duty_start_date?: string
    custom_is_branch_manager?: 0 | 1 | boolean
    custom_managed_branch?: string
    custom_has_company_vehicle?: 0 | 1 | boolean
    custom_vehicle_plate?: string
    custom_vehicle_model?: string
    custom_vehicle_ownership?: string
    custom_home_address?: string
    custom_home_latitude?: number
    custom_home_longitude?: number
    custom_emergency_2_name?: string
    custom_emergency_2_relation?: string
    custom_emergency_2_phone?: string
    custom_emergency_3_name?: string
    custom_emergency_3_relation?: string
    custom_emergency_3_phone?: string
    creation?: string
    modified?: string
}

export interface Attendance {
    name: string
    employee: string
    employee_name?: string
    attendance_date: string
    status: 'Present' | 'Absent' | 'On Leave' | 'Half Day' | 'Work From Home'
    shift?: string
    in_time?: string
    out_time?: string
    working_hours?: number
    late_entry?: boolean
    early_exit?: boolean
}

export interface LeaveApplication {
    name: string
    employee: string
    employee_name?: string
    leave_type: string
    from_date: string
    to_date: string
    total_leave_days: number
    description?: string
    status: 'Open' | 'Approved' | 'Rejected' | 'Cancelled'
    leave_approver?: string
    docstatus?: number
    is_lwp?: 0 | 1
    custom_illness_type?: string
    custom_medical_certificate?: string
}

export interface EmployeeCheckin {
    name: string
    employee: string
    employee_name?: string
    time: string
    log_type?: 'IN' | 'OUT'
    shift?: string
    overtime_type?: string
    device_id?: string
    skip_auto_attendance?: number
    attendance?: string
    checkin_method?: string
    photo_image?: string
    biometric_verified?: number
    biometric_type?: 'Fingerprint' | 'Face ID' | 'Touch ID'
    latitude?: number
    longitude?: number
    shift_start?: string
    shift_end?: string
    shift_actual_start?: string
    shift_actual_end?: string
    offshift?: number
    creation?: string
    modified?: string
}

export interface LocationLog {
    name?: string
    log_datetime: string
    latitude: number
    longitude: number
    accuracy?: number
    address?: string
}

export interface HolidayList {
    name: string
    holiday_list_name: string
    from_date: string
    to_date: string
    total_holidays?: number
    weekly_off?: string
    color?: string
    country?: string
    holidays?: Array<{
        holiday_date: string
        description: string
        weekly_off: 0 | 1
    }>
}

export interface Company {
    name: string
    company_name?: string
    default_holiday_list?: string
}

export type FrappeFilterValue = string | number | boolean | string[] | number[] | null

/**
 * Frappe's REST API accepts a filter either way round, and both forms are used here:
 *   `['status', '=', 'Active']`              — field on the doctype being listed
 *   `['Employee', 'status', '=', 'Active']`  — field qualified by doctype
 * Typing only the 4-element form made every 3-element filter in the app a type error
 * even though the server has always honoured it.
 */
export type FrappeFilter =
    | [string, string, FrappeFilterValue]
    | [string, string, string, FrappeFilterValue]

export interface FrappeRequestOptions {
    fields?: string[]
    filters?: FrappeFilter[]
    /** ORed together, ANDed with `filters` — server-side search across several fields.
     *  Passed straight through /api/resource → frappe.client.get_list. */
    or_filters?: FrappeFilter[]
    order_by?: string
    limit_page_length?: number
    limit_start?: number
}

// ==================== API Client Class ====================

export class FrappeAPIClient {
constructor(_baseUrl?: string) { }

    /** @deprecated Not used — session auth via cookies, not bearer tokens. Kept for backward compat. */
    setToken(token: string): void {
        (this as any)._token = token
    }

    /** @deprecated Not used — session auth via cookies, not API key/secret. Kept for backward compat. */
    setAPICredentials(apiKey: string, apiSecret: string): void {
        (this as any)._apiKey = apiKey;
        (this as any)._apiSecret = apiSecret
    }

    /** @deprecated Not used — no stored credentials to clear. Kept for backward compat. */
    clearAuth(): void {
        (this as any)._token = null;
        (this as any)._apiKey = null;
        (this as any)._apiSecret = null
    }

    // ==================== CSRF Token ====================

    private csrfToken: string | null = null
    // Guests get an EMPTY token from get_csrf_token, so caching only a truthy token would re-fetch
    // on every call. `csrfFetched` records that we've already tried this session (token or not), and
    // `csrfInflight` dedups concurrent attempts (e.g. a burst of map pans). Reset only on 403/417.
    private csrfFetched = false
    private csrfInflight: Promise<void> | null = null

    async fetchCsrfToken(): Promise<string | null> {
        try {
            const response = await makeDirectRequest('/api/method/base_meena.api.get_csrf_token', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            })
            if (response.ok) {
                const data = await response.json()
                const token = data.message
                if (token && typeof document !== 'undefined') {
                    this.csrfToken = token
                    document.cookie = `csrf_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`
                    return token
                }
            }
        } catch (err) {
            console.warn('[API] Failed to fetch CSRF token:', err)
        } finally {
            this.csrfFetched = true // we tried once — don't re-fetch on every subsequent call
        }
        return null
    }

    private async ensureCsrfToken(): Promise<void> {
        if (this.csrfToken || this.csrfFetched) return
        if (this.csrfInflight) return this.csrfInflight
        this.csrfInflight = (async () => {
            if (typeof document !== 'undefined') {
                const csrf = document.cookie
                    .split('; ')
                    .find(r => r.startsWith('csrf_token=') || r.startsWith('csrftoken='))
                    ?.split('=')[1]
                if (csrf) {
                    this.csrfToken = decodeURIComponent(csrf)
                    this.csrfFetched = true
                    return
                }
            }
            await this.fetchCsrfToken() // sets csrfFetched in finally
        })()
        try { await this.csrfInflight } finally { this.csrfInflight = null }
    }

    // Frappe raises CSRFTokenError as HTTP 400 (body exc_type "CSRFTokenError"),
    // NOT 403/417 — so a stale/empty cached token makes every write fail hard with
    // "Invalid Request / طلب غير صالح" and, without this, no retry. We detect the
    // CSRF case specifically (a plain 400 ValidationError must NOT trigger a token
    // refetch+resubmit) by peeking at a clone of the response body.
    private async isCsrfError(response: Response): Promise<boolean> {
        if (![400, 403, 417].includes(response.status)) return false
        try {
            const data = await response.clone().json()
            const exc = String(data?.exc_type || data?.exception || '')
            if (exc) return exc.includes('CSRFTokenError')
        } catch { /* non-JSON body */ }
        // Older Frappe returns 417/403 with a plain "Invalid Request" body and no
        // exc_type — treat those as CSRF (they are never used for anything else here).
        return response.status === 417 || response.status === 403
    }

    // Reset the cached token so the next fetch actually re-fetches (csrfFetched
    // otherwise latches true — even after an empty fetch — and blocks recovery).
    private async refreshCsrfToken(): Promise<void> {
        this.csrfToken = null
        this.csrfFetched = false
        await this.fetchCsrfToken()
    }

    // ==================== Authentication ====================

    async login(email: string, password: string): Promise<{ success: boolean, message?: string }> {
        try {
            const response = await makeDirectRequest('/api/method/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    usr: email,
                    pwd: password,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                // Fetch CSRF token after successful login
                await this.fetchCsrfToken()
                return { success: true, message: data.message }
            } else {
                return { success: false, message: 'Login failed' }
            }
        } catch (error) {
            console.error('Login error:', error)
            return { success: false, message: 'Network error' }
        }
    }

    async logout(): Promise<void> {
        try {
            await makeDirectRequest('/api/method/logout', {
                method: 'POST',
            })
        } catch (error) {
            console.error('Logout error:', error)
        }
    }

    // ==================== Headers ====================

    private getHeaders(): HeadersInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        // Use cached token first, then try cookie
        if (this.csrfToken) {
            headers['X-Frappe-CSRF-Token'] = this.csrfToken
        } else if (typeof document !== 'undefined') {
            const csrf = document.cookie
                .split('; ')
                .find(r => r.startsWith('csrf_token=') || r.startsWith('csrftoken='))
                ?.split('=')[1]
            if (csrf) headers['X-Frappe-CSRF-Token'] = decodeURIComponent(csrf)
        }
        return headers
    }

    // ==================== Error Parsing Helper ====================

    private async parseErrorResponse(response: Response, method: string, doctype: string): Promise<string> {
        let errorMsg = `${method} ${doctype} failed (HTTP ${response.status})`
        try {
            const errorData = await response.json()
            // Prefer Frappe's user-facing server messages (what frappe.throw produced),
            // e.g. a ValidationError raised by base_meena leave validation. Fall back to
            // the exception fields, stripping the Python class prefix in every case.
            if (errorData._server_messages) {
                try {
                    const msgs = JSON.parse(errorData._server_messages)
                    const parsed = JSON.parse(msgs[0])
                    if (parsed?.message) errorMsg = stripExceptionClass(String(parsed.message))
                } catch { /* fall through to other fields */ }
            } else if (errorData._error_message) {
                errorMsg = stripExceptionClass(String(errorData._error_message))
            } else if (errorData.exception) {
                errorMsg = stripExceptionClass(String(errorData.exception))
            } else if (errorData.exc) {
                errorMsg = stripExceptionClass(String(errorData.exc))
            } else if (typeof errorData.message === 'string') {
                errorMsg = stripExceptionClass(errorData.message)
            }
        } catch { /* response body wasn't JSON, keep default message */ }
        return errorMsg
    }

    // ==================== Core Methods ====================

    async get<T = any>(
        doctype: string,
        name?: string,
        options?: FrappeRequestOptions
    ): Promise<FrappeResponse<T>> {
        let path = `/api/resource/${doctype}`

        if (name) {
            path += `/${encodeURIComponent(name)}`
        } else if (options) {
            const params = new URLSearchParams()

            if (options.fields) {
                params.append('fields', JSON.stringify(options.fields))
            }

            if (options.filters) {
                params.append('filters', JSON.stringify(options.filters))
            }

            if (options.or_filters?.length) {
                params.append('or_filters', JSON.stringify(options.or_filters))
            }

            if (options.order_by) {
                params.append('order_by', options.order_by)
            }

            // NOTE: 0 means "no limit" in Frappe and must be sent — a plain
            // truthiness check silently dropped it, capping every list at the
            // server default of 20 rows.
            if (options.limit_page_length !== undefined && options.limit_page_length !== null) {
                params.append('limit_page_length', options.limit_page_length.toString())
            }

            if (options.limit_start) {
                params.append('limit_start', options.limit_start.toString())
            }

            path += `?${params.toString().replace(/\+/g, '%20')}`
        }

        const response = await makeDirectRequest(path, {
            method: 'GET',
            headers: this.getHeaders(),
        })

        if (!response.ok) {
            const errorMsg = await this.parseErrorResponse(response, 'GET', doctype)
            if (response.status !== 401 && response.status !== 403) console.warn(`[API] ${errorMsg}`)
            throw authError(response.status, errorMsg)
        }

        return await response.json()
    }

    async post<T = any, TData = Partial<T>>(doctype: string, data: TData): Promise<FrappeResponse<T>> {
        const path = `/api/resource/${doctype}`

        let response = await makeDirectRequest(path, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        })

        // Retry once on CSRF error (token may have expired)
        if (await this.isCsrfError(response)) {
            await this.refreshCsrfToken()
            response = await makeDirectRequest(path, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data),
            })
        }

        if (!response.ok) {
            const errorMsg = await this.parseErrorResponse(response, 'POST', doctype)
            if (response.status !== 401 && response.status !== 403) console.warn(`[API] ${errorMsg}`)
            throw authError(response.status, errorMsg)
        }

        return await response.json()
    }

    async put<T = any, TData = Partial<T>>(doctype: string, name: string, data: TData): Promise<FrappeResponse<T>> {
        const path = `/api/resource/${doctype}/${encodeURIComponent(name)}`

        let response = await makeDirectRequest(path, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        })

        // Retry once on CSRF error
        if (await this.isCsrfError(response)) {
            await this.refreshCsrfToken()
            response = await makeDirectRequest(path, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(data),
            })
        }

        if (!response.ok) {
            const errorMsg = await this.parseErrorResponse(response, 'PUT', `${doctype}/${name}`)
            if (response.status !== 401 && response.status !== 403) console.warn(`[API] ${errorMsg}`)
            throw authError(response.status, errorMsg)
        }

        return await response.json()
    }

    async getList<T = any>(
        doctype: string,
        options?: FrappeRequestOptions
    ): Promise<T[]> {
        const result = await this.get<T[]>(doctype, undefined, options)
        return result.data || []
    }

    async delete(doctype: string, name: string): Promise<FrappeResponse> {
        const path = `/api/resource/${doctype}/${encodeURIComponent(name)}`

        let response = await makeDirectRequest(path, {
            method: 'DELETE',
            headers: this.getHeaders(),
        })

        // Retry once on CSRF error
        if (await this.isCsrfError(response)) {
            await this.refreshCsrfToken()
            response = await makeDirectRequest(path, {
                method: 'DELETE',
                headers: this.getHeaders(),
            })
        }

        if (!response.ok) {
            const errorMsg = await this.parseErrorResponse(response, 'DELETE', `${doctype}/${name}`)
            if (response.status !== 401 && response.status !== 403) console.warn(`[API] ${errorMsg}`)
            throw authError(response.status, errorMsg)
        }

        return await response.json()
    }

    async call<T = any>(method: string, args?: Record<string, any>, signal?: AbortSignal): Promise<FrappeResponse<T>> {
        await this.ensureCsrfToken()
        const path = `/api/method/${method}`

        let response = await makeDirectRequest(path, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(args || {}),
            signal,
        })

        // Retry once on CSRF / auth error (Frappe returns 417 for missing/invalid
        // CSRF token with body "Invalid Request" — no need to check body text)
        if (await this.isCsrfError(response)) {
            await this.refreshCsrfToken()
            response = await makeDirectRequest(path, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(args || {}),
                signal,
            })
        }

        if (!response.ok) {
            const errorMsg = await this.parseErrorResponse(response, 'CALL', method)
            if (response.status !== 401 && response.status !== 403) console.warn(`[API] ${errorMsg}`)
            throw authError(response.status, errorMsg)
        }

        return await response.json()
    }

    // ==================== Employee Methods ====================

    async getEmployees(options?: FrappeRequestOptions): Promise<Employee[]> {
        const response = await this.get<Employee[]>('Employee', undefined, options)
        return response.data || []
    }

    async getEmployee(employeeId: string): Promise<Employee | null> {
        const response = await this.get<Employee>('Employee', employeeId)
        return response.data || null
    }

    async createEmployee(employee: Partial<Employee>): Promise<Employee | null> {
        const response = await this.post<Employee>('Employee', employee)
        return response.data || null
    }

    async updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<Employee | null> {
        const response = await this.put<Employee>('Employee', employeeId, updates)
        return response.data || null
    }

    async deleteEmployee(employeeId: string): Promise<boolean> {
        try {
            await this.delete('Employee', employeeId)
            return true
        } catch (error) {
            return false
        }
    }

    /**
     * Comprehensive employee search: one query OR-matched (substring,
     * case-insensitive, Arabic-safe) against ID, employee number, all name
     * parts, phone (formatting-insensitive), national ID/Iqama, emails,
     * designation, department, branch and vehicle plate — server-side.
     */
    async searchEmployees(query: string): Promise<Employee[]> {
        if (!query?.trim()) return []
        const result = await this.call<Employee[]>(
            'base_meena.employee_search_api.search_employees',
            { query: query.trim() }
        )
        return (result as any)?.message || []
    }

    // ==================== Attendance Methods ====================

    async getAttendance(options?: FrappeRequestOptions): Promise<Attendance[]> {
        const response = await this.get<Attendance[]>('Attendance', undefined, options)
        return response.data || []
    }

    async markAttendance(attendance: Partial<Attendance>): Promise<Attendance | null> {
        const response = await this.post<Attendance>('Attendance', attendance)
        return response.data || null
    }

    async deleteAttendance(attendanceId: string): Promise<boolean> {
        try {
            await this.delete('Attendance', attendanceId)
            return true
        } catch (error) {
            return false
        }
    }

    async getEmployeeAttendance(employeeId: string, fromDate: string, toDate: string): Promise<Attendance[]> {
        return this.getAttendance({
            filters: [
                ['Attendance', 'employee', '=', employeeId],
                ['Attendance', 'attendance_date', '>=', fromDate],
                ['Attendance', 'attendance_date', '<=', toDate],
            ],
            order_by: 'attendance_date desc',
        })
    }

    // ==================== Leave Methods ====================

    async getLeaveApplications(options?: FrappeRequestOptions): Promise<LeaveApplication[]> {
        const response = await this.get<LeaveApplication[]>('Leave Application', undefined, options)
        return response.data || []
    }

    async createLeaveApplication(leave: Partial<LeaveApplication>): Promise<LeaveApplication | null> {
        const response = await this.post<LeaveApplication>('Leave Application', leave)
        return response.data || null
    }

    async getEmployeeLeaves(employeeId: string): Promise<LeaveApplication[]> {
        return this.getLeaveApplications({
            filters: [['Leave Application', 'employee', '=', employeeId]],
            order_by: 'from_date desc',
        })
    }

    async approveLeaveApplication(leaveName: string): Promise<LeaveApplication | null> {
        try {
            // First set status to Approved
            await this.put<LeaveApplication>('Leave Application', leaveName, {
                status: 'Approved',
            })
            // Then fetch full doc and submit via Frappe hooks
            const docRes = await this.get<LeaveApplication>('Leave Application', leaveName)
            const doc = docRes.data
            if (!doc) throw new Error('Leave Application not found')
            const resp = await this.call<LeaveApplication>('frappe.client.submit', { doc: { ...doc, doctype: 'Leave Application' } })
            return resp.message || resp.data || null
        } catch (error) {
            console.error('Error approving leave:', error)
            throw error
        }
    }

    async rejectLeaveApplication(leaveName: string, reason?: string): Promise<LeaveApplication | null> {
        try {
            await this.put<LeaveApplication>('Leave Application', leaveName, {
                status: 'Rejected',
            })
            const docRes = await this.get<LeaveApplication>('Leave Application', leaveName)
            const doc = docRes.data
            if (!doc) throw new Error('Leave Application not found')
            const resp = await this.call<LeaveApplication>('frappe.client.submit', { doc: { ...doc, doctype: 'Leave Application' } })
            return resp.message || resp.data || null
        } catch (error) {
            console.error('Error rejecting leave:', error)
            throw error
        }
    }

    async cancelLeaveApplication(leaveName: string): Promise<LeaveApplication | null> {
        try {
            const resp = await this.call<LeaveApplication>('frappe.client.cancel', { doctype: 'Leave Application', name: leaveName })
            return resp.message || resp.data || null
        } catch (error) {
            console.error('Error cancelling leave:', error)
            throw error
        }
    }

    async getLeaveApplication(leaveName: string): Promise<LeaveApplication | null> {
        try {
            const response = await this.get<LeaveApplication>('Leave Application', leaveName)
            return response.data || null
        } catch (error) {
            console.error('Error fetching leave application:', error)
            return null
        }
    }

    // ==================== Holiday List Methods ====================

    async getHolidayLists(options?: FrappeRequestOptions): Promise<HolidayList[]> {
        const response = await this.get<HolidayList[]>('Holiday List', undefined, options)
        return response.data || []
    }

    async getHolidayList(holidayListName: string): Promise<HolidayList | null> {
        try {
            const response = await this.get<HolidayList>('Holiday List', holidayListName)
            return response.data || null
        } catch (error) {
            console.error('Error fetching holiday list:', error)
            return null
        }
    }

    async createHolidayList(holidayList: Partial<HolidayList>): Promise<HolidayList | null> {
        try {
            const response = await this.post<HolidayList>('Holiday List', holidayList)
            return response.data || null
        } catch (error) {
            console.error('Error creating holiday list:', error)
            throw error
        }
    }

    async getCompany(companyName: string): Promise<Company | null> {
        try {
            const response = await this.get<Company>('Company', companyName, {
                fields: ['name', 'company_name', 'default_holiday_list']
            })
            return response.data || null
        } catch (error) {
            console.error('Error fetching company:', error)
            return null
        }
    }

    async setCompanyDefaultHolidayList(companyName: string, holidayListName: string): Promise<boolean> {
        try {
            await this.put<Company>('Company', companyName, {
                default_holiday_list: holidayListName
            })
            return true
        } catch (error) {
            console.error('Error setting company default holiday list:', error)
            throw error
        }
    }

    async setEmployeeHolidayList(employeeId: string, holidayListName: string): Promise<boolean> {
        try {
            await this.put<Employee>('Employee', employeeId, {
                holiday_list: holidayListName
            } as any)
            return true
        } catch (error) {
            console.error('Error setting employee holiday list:', error)
            throw error
        }
    }

    /**
     * Check if employee or company has a holiday list set
     * Returns the holiday list name or null if not found
     */
    async checkHolidayList(employeeId: string): Promise<{
        hasHolidayList: boolean
        source: 'employee' | 'company' | null
        holidayListName: string | null
        companyName: string | null
    }> {
        try {
            // Get employee data
            const employee = await this.getEmployee(employeeId)
            if (!employee) {
                return { hasHolidayList: false, source: null, holidayListName: null, companyName: null }
            }

            // Check if employee has holiday list
            if ((employee as any).holiday_list) {
                return {
                    hasHolidayList: true,
                    source: 'employee',
                    holidayListName: (employee as any).holiday_list,
                    companyName: employee.company || null
                }
            }

            // Check company default holiday list
            if (employee.company) {
                const company = await this.getCompany(employee.company)
                if (company?.default_holiday_list) {
                    return {
                        hasHolidayList: true,
                        source: 'company',
                        holidayListName: company.default_holiday_list,
                        companyName: employee.company
                    }
                }
            }

            return {
                hasHolidayList: false,
                source: null,
                holidayListName: null,
                companyName: employee.company || null
            }
        } catch (error) {
            console.error('Error checking holiday list:', error)
            return { hasHolidayList: false, source: null, holidayListName: null, companyName: null }
        }
    }

    /**
     * Automatically create and assign a default holiday list for a company
     */
    async ensureCompanyHolidayList(companyName: string): Promise<string> {
        try {
            // Check if company already has a holiday list
            const company = await this.getCompany(companyName)
            if (company?.default_holiday_list) {
                return company.default_holiday_list
            }

            // Get current year
            const currentYear = new Date().getFullYear()

            // Check if a holiday list already exists for this year matching the company name
            const existingLists = await this.getHolidayLists({
                filters: [
                    ['Holiday List', 'holiday_list_name', 'like', `%${companyName}%${currentYear}%`],
                    ['Holiday List', 'from_date', '>=', `${currentYear}-01-01`],
                    ['Holiday List', 'to_date', '<=', `${currentYear}-12-31`]
                ],
                limit_page_length: 1
            })

            let holidayListName: string

            if (existingLists.length > 0) {
                holidayListName = existingLists[0].name
            } else {
                // Create a new holiday list for the company
                const newHolidayList = await this.createHolidayList({
                    holiday_list_name: `${companyName} - ${currentYear}`,
                    from_date: `${currentYear}-01-01`,
                    to_date: `${currentYear}-12-31`,
                    weekly_off: 'Friday'
                })

                if (!newHolidayList) {
                    throw new Error('Failed to create holiday list')
                }

                holidayListName = newHolidayList.name
            }

            // Set as company default
            await this.setCompanyDefaultHolidayList(companyName, holidayListName)

            return holidayListName
        } catch (error) {
            console.error('Error ensuring company holiday list:', error)
            throw error
        }
    }

    // ==================== Department & Branch Methods ====================

    async getDepartments(options?: FrappeRequestOptions): Promise<any> {
        try {
            const response = await this.get('Department', undefined, {
                fields: ['name', 'department_name', 'parent_department', 'company', 'is_group'],
                ...options
            })
            return response
        } catch (error) {
            console.error('Error fetching departments:', error)
            return { data: [] }
        }
    }

    async getBranches(options?: FrappeRequestOptions): Promise<any> {
        try {
            const response = await this.get('Branch', undefined, {
                fields: ['name', 'branch', 'company'],
                ...options
            })
            return response
        } catch (error) {
            console.error('Error fetching branches:', error)
            return { data: [] }
        }
    }

    // ==================== Employee Checkin Methods ====================

    async getEmployeeCheckins(options?: FrappeRequestOptions): Promise<EmployeeCheckin[]> {
        try {
            const response = await this.get<EmployeeCheckin[]>('Employee Checkin', undefined, options)
            return response.data || []
        } catch (error) {
            console.error('Error getting employee checkins:', error)
            return []
        }
    }

    async getEmployeeCheckin(name: string): Promise<EmployeeCheckin | null> {
        try {
            const response = await this.get<EmployeeCheckin>('Employee Checkin', name)
            return response.data || null
        } catch (error) {
            console.error('Error getting employee checkin:', error)
            return null
        }
    }

    async createEmployeeCheckin(data: Partial<EmployeeCheckin>): Promise<EmployeeCheckin | null> {
        try {
            const response = await this.post('Employee Checkin', data)
            return response.data || null
        } catch (error) {
            console.error('Error creating employee checkin:', error)
            throw error
        }
    }

    async updateEmployeeCheckin(name: string, data: Partial<EmployeeCheckin>): Promise<EmployeeCheckin | null> {
        try {
            const response = await this.put('Employee Checkin', name, data)
            return response.data || null
        } catch (error) {
            console.error('Error updating employee checkin:', error)
            throw error
        }
    }

    async deleteEmployeeCheckin(name: string): Promise<void> {
        try {
            await this.delete('Employee Checkin', name)
        } catch (error) {
            console.error('Error deleting employee checkin:', error)
            throw error
        }
    }

    async getEmployeeCheckinStats(employee: string, fromDate: string, toDate: string): Promise<any> {
        try {
            const path = `/api/method/hrms.hr.doctype.employee_checkin.employee_checkin_api.get_employee_checkin_stats`
            const params = new URLSearchParams({
                employee,
                from_date: fromDate,
                to_date: toDate
            })
            const response = await makeDirectRequest(`${path}?${params.toString()}`)
            const data = await response.json()
            return data.message || {}
        } catch (error) {
            console.error('Error getting checkin stats:', error)
            return {}
        }
    }

    async getTodaysCheckins(department?: string, shift?: string): Promise<any[]> {
        try {
            const path = '/api/method/hrms.hr.doctype.employee_checkin.employee_checkin_api.get_todays_checkins'
            const params: any = {}
            if (department) params.department = department
            if (shift) params.shift = shift

            const queryString = new URLSearchParams(params).toString()
            const response = await makeDirectRequest(`${path}${queryString ? '?' + queryString : ''}`)
            const data = await response.json()
            return data.message || []
        } catch (error) {
            console.error('Error getting today\'s checkins:', error)
            return []
        }
    }

    async getCheckinMethod(employee: string): Promise<{
        checkin_method: string
        require_photo?: number
        require_biometric?: number
    }> {
        try {
            const path = '/api/method/hrms.hr.doctype.employee_location_settings.checkin_method_api.get_checkin_method'
            const params = new URLSearchParams({ employee })
            const response = await makeDirectRequest(`${path}?${params.toString()}`)
            const data = await response.json()
            return data.message || { checkin_method: 'Manual' }
        } catch (error) {
            console.error('Error getting checkin method:', error)
            return { checkin_method: 'Manual' }
        }
    }

    // ==================== Expense & Claims Methods ====================

    async sanctionExpenseClaim(claimName: string): Promise<any> {
        try {
            // Set status first, then submit via Frappe hooks
            await this.put('Expense Claim', claimName, { approval_status: 'Approved' })
            const docRes = await this.get('Expense Claim', claimName)
            const doc = docRes.data
            if (!doc) throw new Error('Expense Claim not found')
            const resp = await this.call('frappe.client.submit', { doc: { ...doc, doctype: 'Expense Claim' } })
            return resp.message || resp.data || null
        } catch (error) {
            console.error('Error sanctioning expense claim:', error)
            throw error
        }
    }

    async payExpenseClaim(claimName: string): Promise<any> {
        try {
            const response = await this.put('Expense Claim', claimName, {
                status: 'Paid'
            })
            return response.data || null
        } catch (error) {
            console.error('Error marking expense claim as paid:', error)
            throw error
        }
    }

    async approveEmployeeAdvance(advanceName: string): Promise<any> {
        try {
            await this.put('Employee Advance', advanceName, { status: 'Approved' })
            const docRes = await this.get('Employee Advance', advanceName)
            const doc = docRes.data
            if (!doc) throw new Error('Employee Advance not found')
            const resp = await this.call('frappe.client.submit', { doc: { ...doc, doctype: 'Employee Advance' } })
            return resp.message || resp.data || null
        } catch (error) {
            console.error('Error approving employee advance:', error)
            throw error
        }
    }

    async rejectEmployeeAdvance(advanceName: string): Promise<any> {
        try {
            // Reject doesn't submit - just updates status
            const response = await this.put('Employee Advance', advanceName, {
                status: 'Rejected',
            })
            return response.data || null
        } catch (error) {
            console.error('Error rejecting employee advance:', error)
            throw error
        }
    }

    // ==================== Location Tracking Methods ====================

    /**
     * Get employee locations for a specific date or date range
     * Uses the custom location_api endpoint
     */
    async getEmployeeLocations(
        employee: string,
        options?: { date?: string; from_date?: string; to_date?: string }
    ): Promise<LocationLog[]> {
        try {
            const params: Record<string, string> = { employee }
            if (options?.date) params.date = options.date
            if (options?.from_date) params.from_date = options.from_date
            if (options?.to_date) params.to_date = options.to_date

            const path = '/api/method/hrms.hr.doctype.employee_location_log.location_api.get_employee_locations'
            const queryString = new URLSearchParams(params).toString()
            const response = await makeDirectRequest(`${path}?${queryString}`)
            const data = await response.json()
            return data.message || []
        } catch (error) {
            console.error('Error getting employee locations:', error)
            // Fallback: try Employee Checkin with coordinates
            return this.getEmployeeLocationsFromCheckins(employee, options?.date || new Date().toISOString().split('T')[0])
        }
    }

    /**
     * Fallback: get locations from Employee Checkin records
     */
    private async getEmployeeLocationsFromCheckins(employee: string, date: string): Promise<LocationLog[]> {
        try {
            const response = await this.get<any[]>('Employee Checkin', undefined, {
                fields: ['name', 'time', 'latitude', 'longitude', 'log_type'],
                filters: [
                    ['Employee Checkin', 'employee', '=', employee],
                    ['Employee Checkin', 'time', '>=', `${date} 00:00:00`],
                    ['Employee Checkin', 'time', '<=', `${date} 23:59:59`],
                ],
                order_by: 'time asc',
                limit_page_length: 200,
            })
            const checkins = response.data || []
            return checkins
                .filter((c: any) => c.latitude && c.longitude && c.latitude !== 0 && c.longitude !== 0)
                .map((c: any) => ({
                    name: c.name,
                    log_datetime: c.time,
                    latitude: parseFloat(c.latitude),
                    longitude: parseFloat(c.longitude),
                    accuracy: 10,
                    address: c.log_type === 'IN' ? 'تسجيل دخول' : c.log_type === 'OUT' ? 'تسجيل خروج' : '',
                }))
        } catch {
            return []
        }
    }

    /**
     * Save employee location via the custom API
     */
    async saveEmployeeLocation(data: {
        employee: string
        latitude: number
        longitude: number
        accuracy?: number
        notes?: string
        attendance?: string
        checkin?: string
    }): Promise<{ success: boolean; name?: string }> {
        try {
            const response = await this.call<{ success: boolean; name: string }>(
                'hrms.hr.doctype.employee_location_log.location_api.save_location',
                data
            )
            return response.message || { success: false }
        } catch (error) {
            console.error('Error saving employee location:', error)
            return { success: false }
        }
    }

    /**
     * Get tracking settings for an employee
     */
    async getTrackingSettings(employee: string): Promise<{
        tracking_enabled?: boolean
        employee_consent?: boolean
        interval_ms?: number
    }> {
        try {
            const path = '/api/method/hrms.hr.doctype.employee_location_log.location_api.get_tracking_settings'
            const params = new URLSearchParams({ employee })
            const response = await makeDirectRequest(`${path}?${params.toString()}`)
            const data = await response.json()
            return data.message || {}
        } catch (error) {
            console.error('Error getting tracking settings:', error)
            return {}
        }
    }

    /**
     * Get locations for multiple employees at once (for admin multi-view)
     */
    async getMultipleEmployeeLocations(
        employeeIds: string[],
        date?: string
    ): Promise<Record<string, LocationLog[]>> {
        const targetDate = date || new Date().toISOString().split('T')[0]
        const results: Record<string, LocationLog[]> = {}

        // Fetch all in parallel
        const promises = employeeIds.map(async (empId) => {
            const locations = await this.getEmployeeLocations(empId, { date: targetDate })
            results[empId] = locations
        })

        await Promise.all(promises)
        return results
    }

    /**
     * Get all active employees and their today's locations in one shot.
     * This is the main method for the live dashboard — no "start tracking" needed.
     * HRMS already records locations continuously during shifts.
     */
    async getAllActiveEmployeeLocations(date?: string): Promise<{
        employees: Array<{ name: string; employee_name: string }>,
        locations: Record<string, LocationLog[]>
        checkinStatus: Record<string, { status: 'IN' | 'OUT' | 'NONE'; time?: string }>
    }> {
        const targetDate = date || new Date().toISOString().split('T')[0]

        // 1. Get all active employees
        const empResponse = await this.get<Array<{ name: string; employee_name: string }>>('Employee', undefined, {
            fields: ['name', 'employee_name'],
            filters: [['Employee', 'status', '=', 'Active']],
            order_by: 'employee_name asc',
            limit_page_length: 200,
        })
        const employees = empResponse.data || []

        // 2. Fetch all their locations in parallel (only for today by default)
        const locations: Record<string, LocationLog[]> = {}
        const checkinStatus: Record<string, { status: 'IN' | 'OUT' | 'NONE'; time?: string }> = {}
        const batchSize = 10 // fetch 10 at a time to avoid overwhelming the server
        for (let i = 0; i < employees.length; i += batchSize) {
            const batch = employees.slice(i, i + batchSize)
            await Promise.all(
                batch.map(async (emp) => {
                    try {
                        const [employeeLocations, latestCheckinResponse] = await Promise.all([
                            this.getEmployeeLocations(emp.name, { date: targetDate }),
                            this.get<any[]>('Employee Checkin', undefined, {
                                fields: ['log_type', 'time'],
                                filters: [
                                    ['Employee Checkin', 'employee', '=', emp.name],
                                ],
                                order_by: 'time desc',
                                limit_page_length: 1,
                            }),
                        ])

                        locations[emp.name] = employeeLocations

                        const latestCheckin = (latestCheckinResponse.data || [])[0] as any
                        const logType = latestCheckin?.log_type
                        if (logType === 'IN' || logType === 'OUT') {
                            checkinStatus[emp.name] = {
                                status: logType,
                                time: latestCheckin?.time,
                            }
                        } else {
                            checkinStatus[emp.name] = { status: 'NONE' }
                        }
                    } catch {
                        locations[emp.name] = []
                        checkinStatus[emp.name] = { status: 'NONE' }
                    }
                })
            )
        }

        return { employees, locations, checkinStatus }
    }

    // ==================== Stats Methods ====================

    async getEmployeeStats(): Promise<{
        total: number
        present: number
        on_leave: number
        absent: number
    }> {
        // Computed from Employee + today's Attendance rather than from a server summary:
        // `hrms.hr.utils.get_employee_stats` does not exist, so the call this used to
        // make always 404'd and always fell through to exactly this code.
        const employees = await this.getEmployees({ filters: [['Employee', 'status', '=', 'Active']] })
        const today = new Date().toISOString().split('T')[0]
        const attendance = await this.getAttendance({
            filters: [['Attendance', 'attendance_date', '=', today]],
        })

        return {
            total: employees.length,
            present: attendance.filter(a => a.status === 'Present').length,
            on_leave: attendance.filter(a => a.status === 'On Leave').length,
            absent: attendance.filter(a => a.status === 'Absent').length,
        }
    }

    /**
     * Issue absence warnings (إنذارات الغياب) for one employee's unexcused days.
     * Server-side it writes the HR Notification Log rows and pushes a PWA
     * notification to the employee when they have a linked user.
     */
    async issueAbsenceWarnings(
        employeeId: string,
        employeeName: string,
        absentDates: string[],
        issuedBy: string
    ): Promise<{ issued: number; skipped: number; pwa_sent: number; no_user: number }> {
        const response = await this.call('base_meena.base_meena.api.issue_absence_warnings', {
            employee_id: employeeId,
            employee_name: employeeName,
            absent_dates: absentDates,
            issued_by: issuedBy,
        })
        return response.message || { issued: 0, skipped: 0, pwa_sent: 0, no_user: 0 }
    }

    // ==================== Expense Claim Methods ====================

    async approveExpenseClaim(claimName: string): Promise<any> {
        try {
            const response = await this.put('Expense Claim', claimName, {
                approval_status: 'Approved',
                status: 'Approved',
                docstatus: 1 // Submit the document
            })
            return response.data || null
        } catch (error) {
            console.error('Error approving expense claim:', error)
            throw error
        }
    }

    async rejectExpenseClaim(claimName: string): Promise<any> {
        try {
            const response = await this.put('Expense Claim', claimName, {
                approval_status: 'Rejected',
                status: 'Rejected',
                docstatus: 1 // Submit the document
            })
            return response.data || null
        } catch (error) {
            console.error('Error rejecting expense claim:', error)
            throw error
        }
    }

    // ==================== Travel Request Methods ====================

    async approveTravelRequest(requestName: string): Promise<any> {
        try {
            const response = await this.put('Travel Request', requestName, {
                status: 'Approved',
                docstatus: 1 // Submit the document
            })
            return response.data || null
        } catch (error) {
            console.error('Error approving travel request:', error)
            throw error
        }
    }

    async rejectTravelRequest(requestName: string): Promise<any> {
        try {
            const response = await this.put('Travel Request', requestName, {
                status: 'Rejected',
                docstatus: 1 // Submit the document
            })
            return response.data || null
        } catch (error) {
            console.error('Error rejecting travel request:', error)
            throw error
        }
    }

    // ==================== Payroll Methods ====================

    // Salary Components
    async getSalaryComponents(options?: FrappeRequestOptions): Promise<any[]> {
        try {
            const response = await this.get('Salary Component', undefined, options)
            return response.data || []
        } catch (error) {
            console.error('Error getting salary components:', error)
            return []
        }
    }

    async getSalaryComponent(name: string): Promise<any | null> {
        try {
            const response = await this.get('Salary Component', name)
            return response.data || null
        } catch (error) {
            console.error('Error getting salary component:', error)
            return null
        }
    }

    async createSalaryComponent(data: any): Promise<any> {
        try {
            const response = await this.post('Salary Component', data)
            return response.data
        } catch (error) {
            console.error('Error creating salary component:', error)
            throw error
        }
    }

    async updateSalaryComponent(name: string, data: any): Promise<any> {
        try {
            const response = await this.put('Salary Component', name, data)
            return response.data
        } catch (error) {
            console.error('Error updating salary component:', error)
            throw error
        }
    }

    async deleteSalaryComponent(name: string): Promise<void> {
        try {
            await this.delete('Salary Component', name)
        } catch (error) {
            console.error('Error deleting salary component:', error)
            throw error
        }
    }

    // Salary Structures
    async getSalaryStructures(options?: FrappeRequestOptions): Promise<any[]> {
        try {
            const response = await this.get('Salary Structure', undefined, options)
            return response.data || []
        } catch (error) {
            console.error('Error getting salary structures:', error)
            throw error
        }
    }

    async getSalaryStructure(name: string): Promise<any | null> {
        try {
            const response = await this.get('Salary Structure', name)
            return response.data || null
        } catch (error) {
            console.error('Error getting salary structure:', error)
            return null
        }
    }

    async createSalaryStructure(data: any): Promise<any> {
        try {
            const response = await this.post('Salary Structure', data)
            return response.data
        } catch (error) {
            console.error('Error creating salary structure:', error)
            throw error
        }
    }

    async updateSalaryStructure(name: string, data: any): Promise<any> {
        try {
            const response = await this.put('Salary Structure', name, data)
            return response.data
        } catch (error) {
            console.error('Error updating salary structure:', error)
            throw error
        }
    }

    async deleteSalaryStructure(name: string): Promise<void> {
        try {
            await this.delete('Salary Structure', name)
        } catch (error) {
            console.error('Error deleting salary structure:', error)
            throw error
        }
    }

    // Salary Structure Assignments
    async getSalaryStructureAssignments(options?: FrappeRequestOptions): Promise<any[]> {
        try {
            const response = await this.get('Salary Structure Assignment', undefined, options)
            return response.data || []
        } catch (error) {
            console.error('Error getting salary structure assignments:', error)
            throw error
        }
    }

    // ── Salary Slip report (read-only; base_meena.salary_slip_api) ──
    async getSalarySlipsReport(filters: { from_date?: string; to_date?: string; employee?: string; department?: string; company?: string }): Promise<any[]> {
        try {
            const res = await this.call('base_meena.salary_slip_api.get_salary_slips', filters)
            return (res as any)?.message || []
        } catch (error) {
            console.error('Error getting salary slips:', error)
            return []
        }
    }

    async getSalarySlipDetail(name: string): Promise<any | null> {
        try {
            const res = await this.call('base_meena.salary_slip_api.get_salary_slip', { name })
            return (res as any)?.message || null
        } catch (error) {
            console.error('Error getting salary slip detail:', error)
            return null
        }
    }

    async getSalaryStructureAssignment(name: string): Promise<any | null> {
        try {
            const response = await this.get('Salary Structure Assignment', name)
            return response.data || null
        } catch (error) {
            console.error('Error getting salary structure assignment:', error)
            return null
        }
    }

    async createSalaryStructureAssignment(data: any): Promise<any> {
        try {
            const response = await this.post('Salary Structure Assignment', data)
            if (!response.data) {
                throw new Error((response.exc || response.message || 'Failed to create salary structure assignment') as string)
            }
            return response.data
        } catch (error) {
            console.error('Error creating salary structure assignment:', error)
            throw error
        }
    }

    async updateSalaryStructureAssignment(name: string, data: any): Promise<any> {
        try {
            const response = await this.put('Salary Structure Assignment', name, data)
            return response.data
        } catch (error) {
            console.error('Error updating salary structure assignment:', error)
            throw error
        }
    }

    async deleteSalaryStructureAssignment(name: string): Promise<void> {
        try {
            await this.delete('Salary Structure Assignment', name)
        } catch (error) {
            console.error('Error deleting salary structure assignment:', error)
            throw error
        }
    }

    // Additional Salary
    async getAdditionalSalaries(options?: FrappeRequestOptions): Promise<any[]> {
        try {
            const response = await this.get('Additional Salary', undefined, options)
            return response.data || []
        } catch (error) {
            console.error('Error getting additional salaries:', error)
            throw error
        }
    }

    async getAdditionalSalary(name: string): Promise<any | null> {
        try {
            const response = await this.get('Additional Salary', name)
            return response.data || null
        } catch (error) {
            console.error('Error getting additional salary:', error)
            return null
        }
    }

    async createAdditionalSalary(data: any): Promise<any> {
        try {
            const response = await this.post('Additional Salary', data)
            if (!response.data) {
                throw new Error((response.exc || response.message || 'Failed to create additional salary') as string)
            }
            return response.data
        } catch (error) {
            console.error('Error creating additional salary:', error)
            throw error
        }
    }

    async updateAdditionalSalary(name: string, data: any): Promise<any> {
        try {
            const response = await this.put('Additional Salary', name, data)
            return response.data
        } catch (error) {
            console.error('Error updating additional salary:', error)
            throw error
        }
    }

    async deleteAdditionalSalary(name: string): Promise<void> {
        try {
            await this.delete('Additional Salary', name)
        } catch (error) {
            console.error('Error deleting additional salary:', error)
            throw error
        }
    }

    // ==================== Payroll Entry Methods ====================

    async getPayrollEntries(options?: FrappeRequestOptions): Promise<any[]> {
        try {
            const response = await this.get('Payroll Entry', undefined, options)
            return response.data || []
        } catch (error) {
            console.error('Error getting payroll entries:', error)
            throw error
        }
    }

    async getPayrollEntry(name: string): Promise<any | null> {
        try {
            const response = await this.get('Payroll Entry', name)
            return response.data || null
        } catch (error) {
            console.error('Error getting payroll entry:', error)
            return null
        }
    }

    /**
     * Company defaults the desk's `payroll_entry.js` fills in when `company`
     * changes. A REST insert never runs that client script, so `currency`,
     * `exchange_rate`, `payroll_payable_account` and `cost_center` — all
     * mandatory on Payroll Entry — arrive empty and the insert dies with a
     * MandatoryError before an entry is ever created.
     */
    async getPayrollEntryDefaults(company: string): Promise<{
        currency?: string
        payroll_payable_account?: string
        cost_center?: string
    }> {
        try {
            const response = await this.get('Company', company, {
                fields: ['default_currency', 'default_payroll_payable_account', 'cost_center'],
            })
            const d: any = response.data || {}
            return {
                currency: d.default_currency,
                payroll_payable_account: d.default_payroll_payable_account,
                cost_center: d.cost_center,
            }
        } catch (error) {
            console.error('Error fetching payroll entry defaults:', error)
            return {}
        }
    }

    /**
     * Candidates for `payroll_payable_account`, using the same filter the desk's
     * link query applies (company + Liability + not a group). `account_type` rides
     * along because Payroll Entry additionally refuses to submit unless the chosen
     * account is typed `Payable` — the caller warns about that up front instead of
     * letting it surface as a server error three steps later.
     */
    async getPayrollPayableAccounts(company: string): Promise<{ name: string; account_type?: string }[]> {
        try {
            return await this.getList('Account', {
                fields: ['name', 'account_type'],
                filters: [
                    ['Account', 'company', '=', company],
                    ['Account', 'root_type', '=', 'Liability'],
                    ['Account', 'is_group', '=', 0],
                ],
                limit_page_length: 0,
                order_by: 'name asc',
            })
        } catch (error) {
            console.error('Error fetching payroll payable accounts:', error)
            return []
        }
    }

    async createPayrollEntry(data: Record<string, any>): Promise<any> {
        try {
            const payload: Record<string, any> = { ...data }
            if (payload.company) {
                const defaults = await this.getPayrollEntryDefaults(payload.company)
                if (!payload.currency) payload.currency = defaults.currency
                if (!payload.payroll_payable_account) payload.payroll_payable_account = defaults.payroll_payable_account
                if (!payload.cost_center) payload.cost_center = defaults.cost_center
                // Only safe to assume parity when the entry runs in the company's
                // own currency; a foreign-currency run needs a real rate.
                if (payload.exchange_rate == null && payload.currency && payload.currency === defaults.currency) {
                    payload.exchange_rate = 1
                }
            }
            const response = await this.post('Payroll Entry', payload)
            if (!response.data) {
                throw new Error((response.exc || response.message || 'Failed to create Payroll Entry') as string)
            }
            return response.data
        } catch (error) {
            console.error('Error creating payroll entry:', error)
            throw error
        }
    }

    async deletePayrollEntry(name: string): Promise<void> {
        try {
            await this.delete('Payroll Entry', name)
        } catch (error) {
            console.error('Error deleting payroll entry:', error)
            throw error
        }
    }

    /**
     * Run a whitelisted *controller* method (an `@frappe.whitelist()` method on the
     * document class) — `frappe.handler.run_doc_method` is the only endpoint that
     * reaches one. Posting its dotted path to `/api/method/` the way a module-level
     * function is posted throws "Method Not Found", because the name does not exist
     * at module scope.
     *
     * Two calling conventions, matching the desk:
     *  - `dt`/`dn`  — server loads the saved doc, runs the method, saves nothing.
     *                 Use for methods whose effect is in OTHER documents.
     *  - `docs`     — send the doc, get the mutated copy back in `response.docs[0]`.
     *                 Use for methods that mutate the doc itself; persist the result
     *                 yourself, since the server discards its in-memory copy.
     */
    async runDocMethod<T = any>(
        doctype: string,
        name: string,
        method: string,
        args?: Record<string, any>
    ): Promise<T> {
        const response = await this.call('frappe.handler.run_doc_method', {
            dt: doctype,
            dn: name,
            method,
            ...(args ? { args: JSON.stringify(args) } : {}),
        })
        return (response.message ?? (response as any).data) as T
    }

    /** As above, but sends the whole document and returns the server's mutated copy. */
    async runDocMethodOnDoc<T = any>(
        doc: Record<string, any>,
        method: string,
        args?: Record<string, any>
    ): Promise<{ doc: T; message: any }> {
        const response = await this.call('frappe.handler.run_doc_method', {
            docs: JSON.stringify(doc),
            method,
            ...(args ? { args: JSON.stringify(args) } : {}),
        })
        const returned = (response as any).docs?.[0]
        if (!returned) {
            throw new Error(`${method} returned no document`)
        }
        return { doc: returned as T, message: (response as any).message }
    }

    /**
     * Step "Get Employees": fill the entry's `employees` child table from its own
     * filters (company/frequency/dates/branch/…) and persist it.
     *
     * `fill_employee_details` mutates the doc and returns unmarked-attendance rows,
     * so it has to go through the `docs` convention AND be saved afterwards —
     * a `dt`/`dn` call would fetch the employees into a copy the server then drops.
     */
    async fillEmployeeDetails(payrollEntryName: string): Promise<any> {
        const entry = await this.getPayrollEntry(payrollEntryName)
        if (!entry) {
            throw new Error(`Payroll Entry ${payrollEntryName} not found`)
        }
        const { doc: filled } = await this.runDocMethodOnDoc<any>(entry, 'fill_employee_details')
        const saved = await this.call('frappe.client.save', { doc: JSON.stringify(filled) })
        return saved.message ?? filled
    }

    /**
     * Step "Create Salary Slips": submitting the entry is what creates the slips —
     * `PayrollEntry.on_submit` calls `create_salary_slips()`. This mirrors the desk,
     * whose "Create Salary Slips" primary action is `frm.save("Submit")`.
     *
     * `create_salary_slips` is only invoked directly as a retry, which is what the
     * desk does too when a submitted entry ends up in status "Failed".
     */
    async createSalarySlips(payrollEntryName: string): Promise<any> {
        const entry = await this.getPayrollEntry(payrollEntryName)
        if (!entry) {
            throw new Error(`Payroll Entry ${payrollEntryName} not found`)
        }
        if (entry.docstatus === 0) {
            const response = await this.call('frappe.client.submit', { doc: JSON.stringify(entry) })
            return response.message ?? response
        }
        return await this.runDocMethod('Payroll Entry', payrollEntryName, 'create_salary_slips')
    }

    /** Step "Submit Salary Slips": submits the slips and books the accrual entry. */
    async submitSalarySlips(payrollEntryName: string): Promise<any> {
        const entry = await this.getPayrollEntry(payrollEntryName)
        if (!entry) {
            throw new Error(`Payroll Entry ${payrollEntryName} not found`)
        }
        const { message } = await this.runDocMethodOnDoc<any>(entry, 'submit_salary_slips')
        return message
    }

    // ==================== Admin Panel - Dock Configuration ====================

    async getDockConfig(): Promise<DockConfig> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.page.dock_config.dock_config.get_full_dock_config',
                { method: 'GET', headers: this.getHeaders() }
            )
            if (!response.ok) throw new Error('Failed to get dock config')
            const data = await response.json()
            return data.message || { exists: false, modules: [] }
        } catch (error) {
            console.error('Error getting dock config:', error)
            return { exists: false, modules: [] }
        }
    }

    async saveDockConfig(config: DockConfig): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.page.dock_config.dock_config.save_full_dock_config',
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ config: { modules: config.modules } }),
                }
            )
            if (!response.ok) throw new Error('Failed to save dock config')
            const data = await response.json()
            return data.message || { success: false }
        } catch (error) {
            console.error('Error saving dock config:', error)
            return { success: false, message: String(error) }
        }
    }

    async resetDockConfig(): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.page.dock_config.dock_config.reset_to_default',
                { method: 'POST', headers: this.getHeaders() }
            )
            if (!response.ok) throw new Error('Failed to reset dock config')
            const data = await response.json()
            return data.message || { success: false }
        } catch (error) {
            console.error('Error resetting dock config:', error)
            return { success: false, message: String(error) }
        }
    }

    async getDockModulesForDisplay(deviceType: 'mobile' | 'desktop' = 'desktop'): Promise<DockModuleDisplay[]> {
        try {
            const response = await makeDirectRequest(
                `/api/method/base_meena.base_meena.api.get_dock_modules_for_display?device_type=${deviceType}`,
                { method: 'GET', headers: this.getHeaders() }
            )
            if (!response.ok) throw new Error('Failed to get dock modules')
            const data = await response.json()
            return data.message || []
        } catch (error) {
            console.error('Error getting dock modules for display:', error)
            return []
        }
    }

    // ==================== Tenant / Site Management ====================

    async listSites(): Promise<TenantSite[]> {
        const response = await makeDirectRequest(
            '/api/method/tenant_manager.api.tenant_settings.list_sites',
            { method: 'GET', headers: this.getHeaders() }
        )
        if (!response.ok) { const e: any = new Error('list_sites failed'); e.status = response.status; throw e }
        const data = await response.json()
        return data.message || []
    }

    async disableSite(site: string): Promise<{ success: boolean }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.disable_site',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site }) }
            )
            if (!response.ok) throw new Error('Failed to disable site')
            return { success: true }
        } catch (error) {
            console.error('Error disabling site:', error)
            return { success: false }
        }
    }

    async enableSite(site: string): Promise<{ success: boolean }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.enable_site',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site }) }
            )
            if (!response.ok) throw new Error('Failed to enable site')
            return { success: true }
        } catch (error) {
            console.error('Error enabling site:', error)
            return { success: false }
        }
    }

    async deleteSite(site: string): Promise<{ success: boolean }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.delete_site',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site }) }
            )
            if (!response.ok) throw new Error('Failed to delete site')
            return { success: true }
        } catch (error) {
            console.error('Error deleting site:', error)
            return { success: false }
        }
    }

    async updateSiteLoginMessage(site: string, message: string): Promise<{ success: boolean }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.update_login_message',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site, message }) }
            )
            if (!response.ok) throw new Error('Failed to update login message')
            return { success: true }
        } catch (error) {
            console.error('Error updating login message:', error)
            return { success: false }
        }
    }

    async getSitesStatus(sites: string[]): Promise<Record<string, SiteProvisionState>> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.get_sites_status',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ sites }) }
            )
            if (!response.ok) return {}
            const data = await response.json().catch(() => ({}))
            return data.message || {}
        } catch (error) {
            console.error('Error polling site status:', error)
            return {}
        }
    }

    async getSiteGrantableModules(site: string): Promise<string[]> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.get_site_grantable_modules',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site }) }
            )
            if (!response.ok) return []
            const data = await response.json().catch(() => ({}))
            return data.message?.modules || []
        } catch (error) {
            console.error('Error fetching grantable modules:', error)
            return []
        }
    }

    async createTenantUser(site: string, email: string, fullName: string, modules: string[], password: string, username?: string): Promise<{ success: boolean; message?: string; roles?: string[]; username?: string | null; login_with?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.create_tenant_user',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site, email, full_name: fullName, modules, password, username: username || undefined }) }
            )
            const data = await response.json().catch(() => ({}))
            const result = data.message || {}
            if (!response.ok || result.success === false) {
                const msg = result.error || (data?._server_messages && (() => { try { return JSON.parse(JSON.parse(data._server_messages)[0]).message } catch { return null } })()) || data?.exception || 'Failed to create user'
                return { success: false, message: String(msg) }
            }
            return { success: true, roles: result.roles, username: result.username, login_with: result.login_with }
        } catch (error) {
            console.error('Error creating tenant user:', error)
            return { success: false, message: String(error) }
        }
    }

    async regenerateTenantInvite(site: string, email: string): Promise<{ success: boolean; message?: string; invite_link?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.regenerate_tenant_invite',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site, email }) }
            )
            const data = await response.json().catch(() => ({}))
            const result = data.message || {}
            if (!response.ok || result.success === false) {
                return { success: false, message: result.error || 'Failed to regenerate invite' }
            }
            return { success: true, invite_link: result.invite_link }
        } catch (error) {
            console.error('Error regenerating invite:', error)
            return { success: false, message: String(error) }
        }
    }

    // ============ Company self-service users (tenant-LOCAL base_meena.* APIs) ============
    // These run against the CURRENT tenant site only (never the control plane). The
    // backend derives roles from module ids and strips forbidden roles, so the client
    // can only ever request safe module access.

    /** Parse a Frappe error message out of a non-ok response body. */
    private parseFrappeError(data: any, fallback: string): string {
        const fromServerMsgs = (() => {
            try { return JSON.parse(JSON.parse(data._server_messages)[0]).message } catch { return null }
        })()
        return String(data?.error || fromServerMsgs || data?.exception || fallback)
    }

    async companyListUsers(): Promise<CompanyUser[]> {
        const response = await makeDirectRequest(
            '/api/method/base_meena.base_meena.api.company_list_users',
            { method: 'GET', headers: this.getHeaders() }
        )
        if (!response.ok) { const e: any = new Error('company_list_users failed'); e.status = response.status; throw e }
        const data = await response.json().catch(() => ({}))
        return data.message || []
    }

    async companyGrantableModules(): Promise<string[]> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.company_grantable_modules',
                { method: 'GET', headers: this.getHeaders() }
            )
            if (!response.ok) return []
            const data = await response.json().catch(() => ({}))
            return data.message || []
        } catch (error) {
            console.error('Error fetching company grantable modules:', error)
            return []
        }
    }

    async companyCreateUser(params: { email: string; fullName: string; modules: string[]; password?: string; username?: string; generateInvite?: boolean }): Promise<{ success: boolean; message?: string; user?: CompanyUser; invite_path?: string | null }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.company_create_user',
                {
                    method: 'POST', headers: this.getHeaders(),
                    body: JSON.stringify({
                        email: params.email, full_name: params.fullName, modules: params.modules,
                        password: params.password || undefined, username: params.username || undefined,
                        generate_invite: params.generateInvite ? 1 : 0,
                    }),
                }
            )
            const data = await response.json().catch(() => ({}))
            const result = data.message || {}
            if (!response.ok || result.success === false) {
                return { success: false, message: this.parseFrappeError(data, 'Failed to create user') }
            }
            return { success: true, user: result.user, invite_path: result.invite_path }
        } catch (error) {
            console.error('Error creating company user:', error)
            return { success: false, message: String(error) }
        }
    }

    async companySetUserModules(user: string, modules: string[]): Promise<{ success: boolean; message?: string; modules?: string[] }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.company_set_user_modules',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ user, modules }) }
            )
            const data = await response.json().catch(() => ({}))
            const result = data.message || {}
            if (!response.ok || result.success === false) {
                return { success: false, message: this.parseFrappeError(data, 'Failed to update modules') }
            }
            return { success: true, modules: result.modules }
        } catch (error) {
            console.error('Error updating company user modules:', error)
            return { success: false, message: String(error) }
        }
    }

    async companyToggleUser(user: string, enabled: boolean): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.company_toggle_user',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ user, enabled: enabled ? 1 : 0 }) }
            )
            const data = await response.json().catch(() => ({}))
            if (!response.ok) return { success: false, message: this.parseFrappeError(data, 'Failed to toggle user') }
            return { success: true }
        } catch (error) {
            console.error('Error toggling company user:', error)
            return { success: false, message: String(error) }
        }
    }

    async companySetPassword(user: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.company_set_password',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ user, new_password: newPassword }) }
            )
            const data = await response.json().catch(() => ({}))
            if (!response.ok) return { success: false, message: this.parseFrappeError(data, 'Failed to set password') }
            return { success: true }
        } catch (error) {
            console.error('Error setting company user password:', error)
            return { success: false, message: String(error) }
        }
    }

    async companyRegenerateInvite(email: string): Promise<{ success: boolean; message?: string; invite_path?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.company_regenerate_invite',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ email }) }
            )
            const data = await response.json().catch(() => ({}))
            const result = data.message || {}
            if (!response.ok || result.success === false) {
                return { success: false, message: this.parseFrappeError(data, 'Failed to regenerate invite') }
            }
            return { success: true, invite_path: result.invite_path }
        } catch (error) {
            console.error('Error regenerating company invite:', error)
            return { success: false, message: String(error) }
        }
    }

    async setSiteBranding(site: string, displayName: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.set_branding',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site, display_name: displayName }) }
            )
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                // Frappe puts thrown messages in _server_messages / exception
                const msg = (data?._server_messages && JSON.parse(data._server_messages)?.[0]) || data?.exception || 'Failed to set branding'
                return { success: false, message: String(msg) }
            }
            return { success: true }
        } catch (error) {
            console.error('Error setting branding:', error)
            return { success: false, message: String(error) }
        }
    }

    async uploadSiteBrandingLogo(site: string, filename: string, contentBase64: string): Promise<{ success: boolean; message?: string; logo?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.upload_branding_logo',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ site, filename, content: contentBase64 }) }
            )
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                const msg = (data?._server_messages && JSON.parse(data._server_messages)?.[0]) || data?.exception || 'Failed to upload logo'
                return { success: false, message: String(msg) }
            }
            return { success: true, logo: data?.message?.logo }
        } catch (error) {
            console.error('Error uploading branding logo:', error)
            return { success: false, message: String(error) }
        }
    }

    async getTenantSettings(): Promise<TenantSettings> {
        const response = await makeDirectRequest(
            '/api/method/tenant_manager.api.tenant_settings.get_tenant_settings',
            { method: 'GET', headers: this.getHeaders() }
        )
        if (!response.ok) throw new Error('tenant_manager not available')
        const data = await response.json()
        return data.message || { allowed_roles: [], restrictions_enabled: false, tenant_type: '' }
    }

    async setTenantSettings(settings: { allowed_roles: string[]; enabled: boolean; tenant_type: string }): Promise<{ success: boolean }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/tenant_manager.api.tenant_settings.set_tenant_settings',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(settings) }
            )
            if (!response.ok) throw new Error('Failed to set tenant settings')
            return { success: true }
        } catch (error) {
            console.error('Error setting tenant settings:', error)
            return { success: false }
        }
    }

    async getRolePresets(): Promise<RolePreset[]> {
        const response = await makeDirectRequest(
            '/api/method/tenant_manager.api.tenant_settings.get_role_presets',
            { method: 'GET', headers: this.getHeaders() }
        )
        if (!response.ok) throw new Error('tenant_manager not available')
        const data = await response.json()
        return data.message || []
    }

    // ==================== Domain Management ====================

    async linkCustomDomain(domain: string): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/domain_manager.api.link_custom_domain',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ domain }) }
            )
            const data = await response.json().catch(() => ({}))
            // Backend (domain_manager.api.link_custom_domain) returns its result in
            // `message` as { success: bool, error?, domain? }. Honor that inner flag —
            // do NOT report success just because the HTTP request returned 200, or
            // every rejected/invalid domain would surface as "linked successfully".
            const result = data.message || {}
            if (!response.ok || result.success === false) {
                return { success: false, message: result.error || result.hint || result.message || 'Failed to link domain' }
            }
            return { success: true, message: result.domain || result.message }
        } catch (error) {
            console.error('Error linking domain:', error)
            return { success: false, message: String(error) }
        }
    }

    // ==================== Site Creator ====================

    async getInstalledApps(): Promise<string[]> {
        const response = await makeDirectRequest(
            '/api/method/site_creator.api.get_installed_apps',
            { method: 'GET', headers: this.getHeaders() }
        )
        if (!response.ok) { const e: any = new Error('get_installed_apps failed'); e.status = response.status; throw e }
        const data = await response.json()
        return data.message || []
    }

    async createSiteRequest(params: CreateSiteParams): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await makeDirectRequest(
                '/api/method/site_creator.api.create_site_request',
                { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(params) }
            )
            const data = await response.json().catch(() => ({}))
            // Backend returns { success, error?, job_id? } in `message`. On a
            // validation failure it returns { success: false, error } with HTTP 200,
            // so we must inspect the inner flag rather than trust response.ok alone.
            const result = data.message || {}
            if (!response.ok || result.success === false) {
                return { success: false, message: result.error || result.message || 'Failed to create site request' }
            }
            return { success: true, message: result.job_id || result.message }
        } catch (error) {
            console.error('Error creating site request:', error)
            return { success: false, message: String(error) }
        }
    }

    async getSiteStatus(subdomain: string): Promise<string> {
        try {
            const response = await makeDirectRequest(
                `/api/method/site_creator.api.get_site_status?subdomain=${encodeURIComponent(subdomain)}`,
                { method: 'GET', headers: this.getHeaders() }
            )
            if (!response.ok) throw new Error('Failed to get site status')
            const data = await response.json()
            return data.message || 'unknown'
        } catch (error) {
            console.error('Error getting site status:', error)
            return 'error'
        }
    }

    // ==================== Admin: System Settings (with Frappe Core fallback) ====================

    async getSystemSettings(): Promise<SystemSettings> {
        // Try custom admin API first
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.admin_get_system_settings',
                { method: 'GET', headers: this.getHeaders() }
            )
            if (response.ok) {
                const data = await response.json()
                return data.message || {}
            }
        } catch (e) { /* fallback below */ }

        // Fallback: Use Frappe core API to read System Settings
        const fields = [
            'language', 'time_zone', 'country', 'currency',
            'date_format', 'time_format', 'number_format', 'first_day_of_the_week',
            'float_precision', 'currency_precision',
            'session_expiry', 'deny_multiple_sessions',
            'disable_user_pass_login', 'allow_login_using_mobile_number',
            'allow_login_using_user_name', 'enable_two_factor_auth',
            'logout_on_password_reset', 'allow_consecutive_login_attempts',
            'allow_login_after_fail', 'force_user_to_reset_password'
        ]
        const params = new URLSearchParams({
            doctype: 'System Settings',
            fieldname: JSON.stringify(fields)
        })
        const fallback = await makeDirectRequest(
            `/api/method/frappe.client.get_value?${params.toString()}`,
            { method: 'GET', headers: this.getHeaders() }
        )
        if (!fallback.ok) throw new Error('Failed to load system settings')
        const fbData = await fallback.json()
        return fbData.message || {}
    }

    async updateSystemSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean }> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    '/api/method/base_meena.base_meena.api.admin_update_system_settings',
                    {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ settings: JSON.stringify(settings) })
                    }
                )
                if (response.ok) return { success: true }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe core set_value for each field
            const failedFields: string[] = []
            for (const [field, value] of Object.entries(settings)) {
                try {
                    const resp = await makeDirectRequest(
                        '/api/method/frappe.client.set_value',
                        {
                            method: 'POST',
                            headers: this.getHeaders(),
                            body: JSON.stringify({ doctype: 'System Settings', name: 'System Settings', fieldname: field, value })
                        }
                    )
                    if (!resp.ok) failedFields.push(field)
                } catch {
                    failedFields.push(field)
                }
            }
            if (failedFields.length > 0) {
                console.error('Failed to update fields:', failedFields)
                return { success: false }
            }
            return { success: true }
        } catch (error) {
            console.error('Error updating system settings:', error)
            return { success: false }
        }
    }

    async getAdminOptions(): Promise<AdminOptions> {
        // Try custom API first
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.admin_get_options',
                { method: 'GET', headers: this.getHeaders() }
            )
            if (response.ok) {
                const data = await response.json()
                return data.message || { languages: [], roles: [], date_formats: [], time_formats: [], number_formats: [], first_day_options: [] }
            }
        } catch (e) { /* fallback below */ }

        // Fallback: Use Frappe core APIs
        const langResp = await makeDirectRequest(
            '/api/method/frappe.client.get_list?' + new URLSearchParams({
                doctype: 'Language',
                fields: JSON.stringify(['name', 'language_name']),
                filters: JSON.stringify([['enabled', '=', 1]]),
                limit_page_length: '200',
                order_by: 'language_name asc'
            }).toString(),
            { method: 'GET', headers: this.getHeaders() }
        )
        let languages: { value: string; label: string }[] = []
        if (langResp.ok) {
            const langData = await langResp.json()
            languages = (langData.message || langData.data || []).map((l: any) => ({ value: l.name, label: l.language_name || l.name }))
        }

        return {
            languages,
            roles: [],
            date_formats: ['dd-mm-yyyy', 'dd/mm/yyyy', 'dd.mm.yyyy', 'mm/dd/yyyy', 'mm-dd-yyyy', 'yyyy-mm-dd'],
            time_formats: ['HH:mm:ss', 'HH:mm'],
            number_formats: ['#,###.##', '#.###,##', '# ###.##', '# ###,##', "#'###.##", '#,###.###', '#,##,###.##', '#.###'],
            first_day_options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        }
    }

    async getSystemRolesMap(): Promise<Record<string, SystemRoleGroup>> {
        // Try custom API first
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.admin_get_system_roles_map',
                { method: 'GET', headers: this.getHeaders() }
            )
            if (response.ok) {
                const data = await response.json()
                return data.message || {}
            }
        } catch (e) { /* fallback below */ }

        // Fallback: hardcoded system-to-roles map
        return {
            hr: { label: 'HR', label_ar: 'الموارد البشرية', color: '#3B82F6', roles: ['HR Manager', 'HR User', 'Employee'] },
            sales: { label: 'Sales', label_ar: 'المبيعات', color: '#22C55E', roles: ['Sales Manager', 'Sales User', 'Sales Master Manager'] },
            purchasing: { label: 'Purchasing', label_ar: 'المشتريات', color: '#F59E0B', roles: ['Purchase Manager', 'Purchase User', 'Purchase Master Manager'] },
            inventory: { label: 'Inventory', label_ar: 'المخزون', color: '#F97316', roles: ['Stock Manager', 'Stock User'] },
            accounting: { label: 'Accounting', label_ar: 'المحاسبة', color: '#8B5CF6', roles: ['Accounts Manager', 'Accounts User'] },
            manufacturing: { label: 'Manufacturing', label_ar: 'التصنيع', color: '#EF4444', roles: ['Manufacturing Manager', 'Manufacturing User'] },
            projects: { label: 'Projects', label_ar: 'المشاريع', color: '#14B8A6', roles: ['Projects Manager', 'Projects User'] },
            support: { label: 'Support', label_ar: 'الدعم الفني', color: '#EC4899', roles: ['Support Team'] },
            quality: { label: 'Quality', label_ar: 'الجودة', color: '#6366F1', roles: ['Quality Manager'] },
            website: { label: 'Website', label_ar: 'الموقع', color: '#06B6D4', roles: ['Website Manager'] },
            admin: { label: 'Administration', label_ar: 'الإدارة', color: '#64748B', roles: ['System Manager', 'Administrator'] },
        }
    }

    // ==================== Admin: Users Management ====================

    async getUsers(): Promise<FrappeUser[]> {
        // Try custom admin API first
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.admin_get_users',
                { method: 'GET', headers: this.getHeaders() }
            )
            if (response.ok) {
                const data = await response.json()
                return data.message || []
            }
        } catch (e) { /* fallback below */ }

        // Fallback: Use Frappe core APIs
        const params = new URLSearchParams({
            doctype: 'User',
            fields: JSON.stringify(['name', 'full_name', 'email', 'enabled', 'user_type', 'last_active', 'creation', 'user_image']),
            filters: JSON.stringify([['name', 'not in', ['Administrator', 'Guest']]]),
            limit_page_length: '0',
            order_by: 'creation desc'
        })
        const resp = await makeDirectRequest(
            `/api/method/frappe.client.get_list?${params.toString()}`,
            { method: 'GET', headers: this.getHeaders() }
        )
        if (!resp.ok) throw new Error('Failed to get users')
        const usersData = await resp.json()
        const users: FrappeUser[] = usersData.message || usersData.data || []

        // Get system roles map to determine systems
        const rolesMap = await this.getSystemRolesMap()

        // Enrich each user with roles — use get_list on Has Role
        for (const user of users) {
            try {
                const rParams = new URLSearchParams({
                    doctype: 'Has Role',
                    fields: JSON.stringify(['role']),
                    filters: JSON.stringify([['parent', '=', user.name]]),
                    limit_page_length: '0'
                })
                const rResp = await makeDirectRequest(
                    `/api/method/frappe.client.get_list?${rParams.toString()}`,
                    { method: 'GET', headers: this.getHeaders() }
                )
                if (rResp.ok) {
                    const rData = await rResp.json()
                    user.roles = (rData.message || rData.data || []).map((r: any) => r.role)
                }
            } catch (e) {
                user.roles = []
            }
            // Determine systems from roles
            const systems: string[] = []
            for (const [sysId, sysData] of Object.entries(rolesMap)) {
                if (sysData.roles.some(r => (user.roles || []).includes(r))) systems.push(sysId)
            }
            user.systems = systems.length > 0 ? systems : ['none']
        }
        return users
    }

    async getUserRoles(user: string): Promise<string[]> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    `/api/method/base_meena.base_meena.api.admin_get_user_roles?user=${encodeURIComponent(user)}`,
                    { method: 'GET', headers: this.getHeaders() }
                )
                if (response.ok) {
                    const data = await response.json()
                    return data.message || []
                }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe core API
            const params = new URLSearchParams({
                doctype: 'Has Role',
                fields: JSON.stringify(['role']),
                filters: JSON.stringify([['parent', '=', user]]),
                limit_page_length: '0'
            })
            const resp = await makeDirectRequest(
                `/api/method/frappe.client.get_list?${params.toString()}`,
                { method: 'GET', headers: this.getHeaders() }
            )
            if (!resp.ok) return []
            const data = await resp.json()
            return (data.message || data.data || []).map((r: any) => r.role)
        } catch (error) {
            console.error('Error getting user roles:', error)
            return []
        }
    }

    async toggleUser(user: string, enabled: boolean): Promise<{ success: boolean }> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    '/api/method/base_meena.base_meena.api.admin_toggle_user',
                    {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ user, enabled: enabled ? 1 : 0 })
                    }
                )
                if (response.ok) {
                    const data = await response.json()
                    return data.message || { success: true }
                }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe core set_value
            const resp = await makeDirectRequest(
                '/api/method/frappe.client.set_value',
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ doctype: 'User', name: user, fieldname: 'enabled', value: enabled ? 1 : 0 })
                }
            )
            return { success: resp.ok }
        } catch (error) {
            console.error('Error toggling user:', error)
            return { success: false }
        }
    }

    async addUserRole(user: string, role: string): Promise<{ success: boolean }> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    '/api/method/base_meena.base_meena.api.admin_add_user_role',
                    {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ user, role })
                    }
                )
                if (response.ok) return { success: true }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe run_doc_method or direct API
            const resp = await makeDirectRequest(
                '/api/resource/User/' + encodeURIComponent(user),
                { method: 'GET', headers: this.getHeaders() }
            )
            if (!resp.ok) throw new Error('Failed to get user')
            const userData = await resp.json()
            const doc = userData.data
            const existingRoles = (doc.roles || []).map((r: any) => r.role)
            if (!existingRoles.includes(role)) {
                doc.roles.push({ role })
                const putResp = await makeDirectRequest(
                    '/api/resource/User/' + encodeURIComponent(user),
                    {
                        method: 'PUT',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ roles: doc.roles })
                    }
                )
                return { success: putResp.ok }
            }
            return { success: true }
        } catch (error) {
            console.error('Error adding role:', error)
            return { success: false }
        }
    }

    async removeUserRole(user: string, role: string): Promise<{ success: boolean }> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    '/api/method/base_meena.base_meena.api.admin_remove_user_role',
                    {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ user, role })
                    }
                )
                if (response.ok) return { success: true }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe REST API
            const resp = await makeDirectRequest(
                '/api/resource/User/' + encodeURIComponent(user),
                { method: 'GET', headers: this.getHeaders() }
            )
            if (!resp.ok) throw new Error('Failed to get user')
            const userData = await resp.json()
            const doc = userData.data
            doc.roles = (doc.roles || []).filter((r: any) => r.role !== role)
            const putResp = await makeDirectRequest(
                '/api/resource/User/' + encodeURIComponent(user),
                {
                    method: 'PUT',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ roles: doc.roles })
                }
            )
            return { success: putResp.ok }
        } catch (error) {
            console.error('Error removing role:', error)
            return { success: false }
        }
    }

    async createUser(email: string, full_name: string, password: string, roles: string[] = []): Promise<{ success: boolean; user?: FrappeUser }> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    '/api/method/base_meena.base_meena.api.admin_create_user',
                    {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ email, full_name, password, roles: JSON.stringify(roles) })
                    }
                )
                if (response.ok) {
                    const data = await response.json()
                    return data.message || { success: true }
                }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe REST API
            const resp = await makeDirectRequest('/api/resource/User', {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    email,
                    first_name: full_name.split(' ')[0],
                    last_name: full_name.split(' ').slice(1).join(' '),
                    new_password: password,
                    send_welcome_email: 0,
                    user_type: 'System User',
                    enabled: 1,
                    roles: roles.map(r => ({ role: r }))
                })
            })
            return { success: resp.ok }
        } catch (error) {
            console.error('Error creating user:', error)
            return { success: false }
        }
    }

    async changeUserPassword(user: string, newPassword: string): Promise<{ success: boolean }> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    '/api/method/base_meena.base_meena.api.admin_change_password',
                    {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ user, new_password: newPassword })
                    }
                )
                if (response.ok) return { success: true }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe set_value
            const resp = await makeDirectRequest(
                '/api/method/frappe.client.set_value',
                {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ doctype: 'User', name: user, fieldname: 'new_password', value: newPassword })
                }
            )
            return { success: resp.ok }
        } catch (error) {
            console.error('Error changing password:', error)
            return { success: false }
        }
    }

    async deleteUser(user: string): Promise<{ success: boolean }> {
        try {
            // Try custom API first
            try {
                const response = await makeDirectRequest(
                    '/api/method/base_meena.base_meena.api.admin_delete_user',
                    {
                        method: 'POST',
                        headers: this.getHeaders(),
                        body: JSON.stringify({ user })
                    }
                )
                if (response.ok) return { success: true }
            } catch (e) { /* fallback below */ }

            // Fallback: Use Frappe REST API
            const resp = await makeDirectRequest(
                '/api/resource/User/' + encodeURIComponent(user),
                { method: 'DELETE', headers: this.getHeaders() }
            )
            return { success: resp.ok }
        } catch (error) {
            console.error('Error deleting user:', error)
            return { success: false }
        }
    }

    async getSystemInfo(): Promise<SystemInfo> {
        // Try custom admin API first
        try {
            const response = await makeDirectRequest(
                '/api/method/base_meena.base_meena.api.admin_get_system_info',
                { method: 'GET', headers: this.getHeaders() }
            )
            if (response.ok) {
                const data = await response.json()
                return data.message || {}
            }
        } catch (e) { /* fallback below */ }

        // Fallback: Use Frappe core APIs
        try {
            const [usersResp, empResp, versionResp] = await Promise.allSettled([
                makeDirectRequest('/api/method/frappe.client.get_count?' + new URLSearchParams({ doctype: 'User', filters: JSON.stringify([['enabled', '=', 1], ['name', 'not in', ['Administrator', 'Guest']]]) }).toString(), { method: 'GET', headers: this.getHeaders() }),
                makeDirectRequest('/api/method/frappe.client.get_count?' + new URLSearchParams({ doctype: 'Employee', filters: JSON.stringify([['status', '=', 'Active']]) }).toString(), { method: 'GET', headers: this.getHeaders() }),
                makeDirectRequest('/api/method/frappe.client.get_value?' + new URLSearchParams({ doctype: 'System Settings', fieldname: JSON.stringify(['setup_complete']) }).toString(), { method: 'GET', headers: this.getHeaders() }),
            ])
            const activeUsers = usersResp.status === 'fulfilled' && usersResp.value.ok ? (await usersResp.value.json()).message || 0 : 0
            const activeEmps = empResp.status === 'fulfilled' && empResp.value.ok ? (await empResp.value.json()).message || 0 : 0
            return {
                total_users: activeUsers,
                active_users: activeUsers,
                total_employees: activeEmps,
                active_employees: activeEmps,
                frappe_version: '-',
                site_name: '-',
                system_user_counts: {},
            }
        } catch (error) {
            console.error('Error getting system info:', error)
            return {} as SystemInfo
        }
    }
}

// ==================== Admin Panel Types ====================

export interface DockMenuItem {
    label: string
    route: string
    icon_name: string
    icon_color: string
    is_enabled: number | boolean
    show_in_mobile: number | boolean
    show_in_desktop: number | boolean
    display_order: number
}

export interface DockModule {
    module_id: string
    label: string
    icon_color: string
    is_enabled: number | boolean
    show_in_mobile: number | boolean
    show_in_desktop: number | boolean
    display_order: number
    menu_items: DockMenuItem[]
}

export interface DockConfig {
    exists?: boolean
    modules: DockModule[]
}

export interface DockModuleDisplay {
    id: string
    label: string
    shortLabel?: string
    bgColor: string
    menuItems: { label: string; route: string; iconName: string; iconColor: string }[]
}

// ==================== Tenant / Site Management Types ====================

export interface TenantSite {
    name: string
    disabled?: boolean | number
    login_message?: string
    display_name?: string
    logo?: string
    tenant_type?: string
    // Provisioning state (from gated list_sites / get_sites_status)
    status?: string
    step?: number
    total_steps?: number
    ready?: boolean
    failed?: boolean
}

export interface SiteProvisionState {
    status: string
    step: number
    ready: boolean
    failed: boolean
}

/** A user as returned by the tenant-local Users & Team panel (base_meena company_* APIs). */
export interface CompanyUser {
    name: string
    full_name?: string
    email: string
    enabled: boolean | number
    username?: string | null
    modules: string[]
    is_employee_user: boolean
    /** Holds a privileged role (System Manager etc.) -> read-only in the panel. */
    protected: boolean
    creation?: string
}

export interface TenantSettings {
    allowed_roles: string[]
    restrictions_enabled: boolean
    tenant_type: string
}

export interface RolePreset {
    name: string
    roles: string[]
}

export interface CreateSiteParams {
    fullname: string
    email: string
    phone: string
    subdomain: string
    domain: string
    admin_password: string
    apps: string[]
    // Optional branding captured at creation (applied once the site is provisioned).
    display_name?: string
    logo_filename?: string
    logo_content?: string  // base64 (may include data: URL prefix)
}

// ==================== System Settings Types ====================

export interface SystemSettings {
    language: string
    time_zone: string
    country: string
    currency: string
    date_format: string
    time_format: string
    number_format: string
    first_day_of_the_week: string
    float_precision: string
    currency_precision: string
    session_expiry: string
    deny_multiple_sessions: number
    disable_user_pass_login: number
    allow_login_using_mobile_number: number
    allow_login_using_user_name: number
    enable_two_factor_auth: number
    logout_on_password_reset: number
    allow_consecutive_login_attempts: number
    allow_login_after_fail: number
    force_user_to_reset_password: number
}

export interface AdminOptions {
    languages: { value: string; label: string }[]
    roles: string[]
    date_formats: string[]
    time_formats: string[]
    number_formats: string[]
    first_day_options: string[]
}

export interface SystemRoleGroup {
    label: string
    label_ar: string
    roles: string[]
    color: string
}

export interface SystemInfo {
    total_users: number
    active_users: number
    total_employees: number
    active_employees: number
    frappe_version: string
    site_name: string
    system_user_counts: Record<string, number>
}

export interface FrappeUser {
    name: string
    full_name: string
    email: string
    enabled: number
    user_type: string
    last_active?: string
    creation: string
    user_image?: string
    roles?: string[]
    systems?: string[]
}

// ==================== Singleton Instance ====================

export const frappeClient = new FrappeAPIClient()

// ==================== Export ====================

export default frappeClient

