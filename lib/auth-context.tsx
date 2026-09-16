'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, getCurrentUser, getUserRoles, getUserInfo } from '@/lib/api'
import { frappeClient } from '@/lib/api-client'
import { renewWalkthroughSession } from '@/lib/public-access'

interface User {
    email: string
    full_name: string
    user_image?: string
    roles: string[]
    company?: string
    employee?: string
}

/** Which system modules a user can access based on their Frappe roles */
export interface UserModuleAccess {
    admin: boolean      // Administrator or System Manager
    hr: boolean         // HR Manager or HR User
    sales: boolean      // Sales Manager or Sales User or Sales Master Manager
    salesReps: boolean  // Sales Manager or Sales User (field operations & POS)
    inventory: boolean  // Admin, Sales Manager, Sales User, or Stock roles
    purchases: boolean  // Admin, Purchase Manager/User, Stock Manager/User
    cashier: boolean    // POS Cashier, POS Shift Supervisor, POS Store Manager, or Admin
    accounting: boolean // Accounts Manager, Accounts User, or Admin
    tasks: boolean      // All authenticated users can view workflow tasks
    realEstate: boolean // Real Estate Manager/Moderator/User, or Admin
    rentals: boolean    // Rentals Manager/User, or Admin — Meena Rentals (egarsys), SSO-bridged
}

interface CompanyInfo {
    company: string | null
    isAdmin: boolean
    allCompanies: string[]
    employee: string | null
}

interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isHRUser: boolean
    isHRManager: boolean
    /** Line-manager: has ≥1 direct report (Employee.reports_to) OR is HR. Data-derived, no new role (F14/F2). */
    isManager: boolean
    /** Employee record linked to this user, if any (self-service). */
    myEmployee: string | null
    /** Access level: employee | manager | hr_supervisor | hr_admin (F14/F2). */
    scopeLevel: string
    isAdmin: boolean
    isSalesUser: boolean
    isSalesRepsUser: boolean
    isCashier: boolean
    isCashierSupervisor: boolean
    isCashierManager: boolean
    /** May use the tenant's self-service Users & Team panel (Company Admin role, or admin). */
    isCompanyAdmin: boolean
    moduleAccess: UserModuleAccess
    /** Module ids present on this tenant at all (app installed / feature on), role-independent. */
    availableModules: string[]
    /** Tenant flavour from site_config (e.g. "freelancer" = freelancer-only site). "" = normal ERP. */
    tenantType: string
    /** Orthogonal per-tenant flag: trim the HR nav to the biometric/attendance
     *  bundle only. Does NOT restrict any other module — the client keeps them all. */
    hrFingerprintOnly: boolean
    /** Per-tenant display flag: keep the admin / Users & Team cards off the
     *  dashboard. Grants nothing and revokes nothing — admins keep every right. */
    hideAdminCards: boolean
    companyInfo: CompanyInfo
    activeCompany: string | null
    switchCompany: (company: string | null) => void
    isLoading: boolean
    login: (email: string, password: string) => Promise<boolean>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
    error: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ company: null, isAdmin: false, allCompanies: [], employee: null })
    const [activeCompany, setActiveCompany] = useState<string | null>(null)
    // Module visibility now comes from the backend (single source of truth):
    // base_meena.api.permission.get_module_visibility. See moduleAccess below.
    // allowedModules = openable now; availableModules = present on this tenant at all.
    const [allowedModules, setAllowedModules] = useState<string[]>([])
    const [availableModules, setAvailableModules] = useState<string[]>([])
    const [tenantType, setTenantType] = useState<string>('')
    // Orthogonal HR-trim flag (biometric/attendance only) — independent of tenantType;
    // the client keeps every other module. From get_module_visibility.hr_fingerprint_only.
    const [hrFingerprintOnly, setHrFingerprintOnly] = useState<boolean>(false)
    const [hideAdminCards, setHideAdminCards] = useState<boolean>(false)
    // F14/F2 — data-derived scope from get_my_scope: line-manager flag, linked Employee, access level.
    const [scopeInfo, setScopeInfo] = useState<{ isManager: boolean; employee: string | null; level: string }>({ isManager: false, employee: null, level: 'employee' })

    const isAuthenticated = !!user
    const isAdmin = user?.roles?.some(r => ['Administrator', 'System Manager'].includes(r)) ?? false
    const isHRUser = isAdmin || (user?.roles?.some(r => ['HR Manager', 'HR User'].includes(r)) ?? false)
    const isHRManager = isAdmin || (user?.roles?.includes('HR Manager') ?? false)
    const isSalesUser = isAdmin || (user?.roles?.some(r => ['Sales Manager', 'Sales User', 'Sales Master Manager'].includes(r)) ?? false)
    const isSalesRepsUser = isAdmin || (user?.roles?.some(r => ['Sales Manager', 'Sales User'].includes(r)) ?? false)
    const isCashier = isAdmin || (user?.roles?.some(r => ['POS Cashier', 'POS Shift Supervisor', 'POS Store Manager'].includes(r)) ?? false)
    const isCashierSupervisor = isAdmin || (user?.roles?.some(r => ['POS Shift Supervisor', 'POS Store Manager'].includes(r)) ?? false)
    const isCashierManager = isAdmin || (user?.roles?.includes('POS Store Manager') ?? false)
    const isCompanyAdmin = isAdmin || (user?.roles?.includes('Company Admin') ?? false)
    // F14/F2 — Manager is data-derived (has direct reports) OR HR; myEmployee from scope or company info.
    const isManager = isHRManager || scopeInfo.isManager
    const myEmployee = scopeInfo.employee || companyInfo.employee || null
    const scopeLevel = scopeInfo.level

    // Derived from the backend's get_allowed_modules() — NOT a hardcoded role map.
    // The backend gates on roles AND module availability (app installed / feature flag),
    // and matching require_module() guards enforce the same on every endpoint.
    const moduleAccess: UserModuleAccess = useMemo(() => {
        const has = (id: string) => allowedModules.includes(id)
        return {
            admin: has('admin'),
            hr: has('hr'),
            sales: has('salesReps'),       // legacy alias: no 'sales' card; tracks salesReps
            salesReps: has('salesReps'),
            inventory: has('inventory'),
            purchases: has('purchases'),
            cashier: has('cashier'),
            accounting: has('accounting'),
            tasks: has('tasks'),
            realEstate: has('realEstate'),
            rentals: has('rentals'),
        }
    }, [allowedModules])

    const switchCompany = useCallback((company: string | null) => {
        setActiveCompany(company)
        if (company) {
            try { localStorage.setItem('active_company', company) } catch { /* ignore */ }
        } else {
            try { localStorage.removeItem('active_company') } catch { /* ignore */ }
        }
    }, [])

    // Fetch company info from backend API
    const fetchCompanyInfo = useCallback(async () => {
        try {
            const resp = await frappeClient.call<{
                company: string | null
                is_admin: boolean
                all_companies: string[]
                employee: string | null
            }>('base_meena.api.get_user_company_info')
            const msg = resp.message || resp.data || ({} as any)
            const info: CompanyInfo = {
                company: msg.company || null,
                isAdmin: !!msg.is_admin,
                allCompanies: msg.all_companies || [],
                employee: msg.employee || null,
            }
            setCompanyInfo(info)
            // Set active company: use saved preference or default
            // Validate saved company still exists in the known list
            let saved: string | null = null
            try { saved = localStorage.getItem('active_company') } catch { /* ignore */ }
            const validCompanies = info.allCompanies || []
            if (saved && validCompanies.includes(saved)) {
                setActiveCompany(saved)
            } else {
                // Clear stale localStorage entry
                if (saved) { try { localStorage.removeItem('active_company') } catch { /* ignore */ } }
                setActiveCompany(info.company || validCompanies[0] || null)
            }
            return info
        } catch (e) {
            console.warn('Failed to fetch company info:', e)
        }
        return null
    }, [])

    // Fetch module visibility — backend source of truth for the cards.
    const fetchAllowedModules = useCallback(async () => {
        try {
            const resp = await frappeClient.call<{ allowed: string[]; available: string[]; tenant_type?: string; hr_fingerprint_only?: boolean; hide_admin_cards?: boolean }>('base_meena.api.permission.get_module_visibility')
            const data = ((resp as any).message ?? (resp as any).data ?? {}) as { allowed?: string[]; available?: string[]; tenant_type?: string; hr_fingerprint_only?: boolean; hide_admin_cards?: boolean }
            const allowed = Array.isArray(data.allowed) ? data.allowed : []
            const available = Array.isArray(data.available) ? data.available : []
            setAllowedModules(allowed)
            setAvailableModules(available)
            setTenantType(typeof data.tenant_type === 'string' ? data.tenant_type : '')
            setHrFingerprintOnly(data.hr_fingerprint_only === true)
            setHideAdminCards(data.hide_admin_cards === true)
            try { localStorage.setItem('tenant_type', typeof data.tenant_type === 'string' ? data.tenant_type : '') } catch { /* */ }
            // Snapshot for OFFLINE boot (network down at launch) so the shell still
            // renders the right cards instead of hiding everything.
            try { localStorage.setItem('module_visibility_snapshot', JSON.stringify({ allowed, available })) } catch { /* */ }
            return allowed
        } catch (e) {
            console.warn('Failed to fetch module visibility:', e)
        }
        return null
    }, [])

    // Check if already logged in
    const checkAuth = useCallback(async () => {
        try {
            const currentUser = await getCurrentUser()
            if (currentUser && currentUser !== 'Guest') {
                const [roles, userInfo] = await Promise.all([
                    getUserRoles(currentUser),
                    getUserInfo(currentUser),
                ])

                const authedUser = {
                    email: currentUser,
                    full_name: userInfo.full_name || currentUser,
                    user_image: userInfo.user_image || undefined,
                    roles,
                }
                setUser(authedUser)
                // Snapshot the verified identity so an OFFLINE boot (network down at
                // launch) can restore the shell instead of showing "Login Required".
                try { localStorage.setItem('auth_user_snapshot', JSON.stringify(authedUser)) } catch { /* */ }
                // Await CSRF token before setting isLoading=false — components mount
                // immediately after that and need the token to make POST requests.
                await frappeClient.fetchCsrfToken().catch(() => { })
                // Module list gates route guards + cards, so resolve it BEFORE clearing
                // isLoading to avoid a flash of hidden/locked modules or a false redirect.
                await fetchAllowedModules()
                // Company info is non-blocking (it's not needed before first render)
                fetchCompanyInfo().then(info => {
                    if (info?.employee) {
                        setUser(prev => prev ? { ...prev, company: info.company || undefined, employee: info.employee || undefined } : null)
                    }
                })
            } else {
                // definitive server verdict: not logged in — clear the offline snapshot too
                setUser(null)
                try { localStorage.removeItem('auth_user_snapshot') } catch { /* */ }
            }
        } catch (e) {
            // NETWORK failure (offline boot, backend down) — not a logout. Restore the
            // last verified identity so the app shell (e.g. the cashier, with its
            // IndexedDB state + sync queue) keeps working; APIs remain the real gate.
            let restored = false
            try {
                const raw = localStorage.getItem('auth_user_snapshot')
                if (raw) {
                    setUser(JSON.parse(raw))
                    restored = true
                    // Restore the last-known module lists so offline cards/guards work.
                    const mraw = localStorage.getItem('module_visibility_snapshot')
                    if (mraw) {
                        const snap = JSON.parse(mraw)
                        setAllowedModules(Array.isArray(snap?.allowed) ? snap.allowed : [])
                        setAvailableModules(Array.isArray(snap?.available) ? snap.available : [])
                    }
                }
            } catch { /* */ }
            if (!restored) {
                console.error('Auth check failed:', e)
                setUser(null)
            }
        } finally {
            setIsLoading(false)
        }
    }, [fetchCompanyInfo, fetchAllowedModules])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    // F14/F2 — resolve the user's scope (line-manager, linked Employee, access level) once authed.
    useEffect(() => {
        if (!isAuthenticated) { setScopeInfo({ isManager: false, employee: null, level: 'employee' }); return }
        let cancelled = false
        frappeClient.call<any>('base_meena.api.scope.get_my_scope')
            .then(resp => {
                if (cancelled) return
                const d = ((resp as any)?.message ?? (resp as any)?.data ?? {}) as any
                setScopeInfo({ isManager: !!d.is_manager, employee: d.employee ?? null, level: typeof d.role_level === 'string' ? d.role_level : 'employee' })
            })
            .catch(() => { /* non-blocking */ })
        return () => { cancelled = true }
    }, [isAuthenticated])

    // H2: Session heartbeat — periodically check if Frappe session is still valid
    useEffect(() => {
        if (!isAuthenticated) return
        const interval = setInterval(async () => {
            try {
                const currentUser = await getCurrentUser()
                if (!currentUser || currentUser === 'Guest') {
                    // Session expired — reopen the walkthrough session in place (no login screen)
                    setUser(null)
                    renewWalkthroughSession()
                }
            } catch {
                // Network error — don't clear session, just skip this check
            }
        }, 5 * 60 * 1000) // Check every 5 minutes
        return () => clearInterval(interval)
    }, [isAuthenticated])

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await apiLogin(email, password)

            if (result.message === 'Logged In' || result.message === 'logged in') {
                const [roles, userInfo] = await Promise.all([
                    getUserRoles(email),
                    getUserInfo(email),
                ])

                setUser({
                    email,
                    full_name: userInfo.full_name || result.full_name || email,
                    user_image: userInfo.user_image || undefined,
                    roles,
                })
                // Fetch CSRF token before any POST requests can fire
                await frappeClient.fetchCsrfToken().catch(() => { })
                // Resolve module list before clearing isLoading (gates cards + route guards)
                await fetchAllowedModules()
                // Fetch company info (non-blocking)
                fetchCompanyInfo().then(info => {
                    if (info?.employee) {
                        setUser(prev => prev ? { ...prev, company: info.company || undefined, employee: info.employee || undefined } : null)
                    }
                })
                setIsLoading(false)
                return true
            } else {
                setError(result.message || 'Login failed')
                setIsLoading(false)
                return false
            }
        } catch (e: any) {
            console.error('Login error:', e)
            const raw = e.message || ''
            // Map common Frappe errors to user-friendly messages
            let friendly: string
            if (raw.includes('AuthenticationError') || raw.includes('Invalid login') || raw.includes('Incorrect password')) {
                friendly = 'Invalid email or password. Please try again.'
            } else if (raw.includes('Too many requests') || raw.includes('LoginLimitExceeded')) {
                friendly = 'Too many login attempts. Please wait a few minutes and try again.'
            } else if (raw.includes('MandatoryError') || raw.includes('mandatory')) {
                friendly = 'Please enter both email and password.'
            } else if (raw.includes('fetch') || raw.includes('network') || raw.includes('Failed to fetch')) {
                friendly = 'Connection failed. Please check your network and try again.'
            } else {
                friendly = 'Login failed. Please try again or contact support.'
            }
            setError(friendly)
            setIsLoading(false)
            return false
        }
    }, [])

    const refreshUser = useCallback(async () => {
        if (!user?.email) return
        try {
            const userInfo = await getUserInfo(user.email)
            setUser(prev => prev ? {
                ...prev,
                full_name: userInfo.full_name || prev.full_name,
                user_image: userInfo.user_image || undefined,
            } : null)
        } catch (e) {
            console.error('Failed to refresh user info:', e)
        }
    }, [user?.email])

    const logout = useCallback(async () => {
        try {
            await apiLogout()
        } catch (e) {
            console.error('Logout error:', e)
        } finally {
            setUser(null)
            setAllowedModules([])
            setAvailableModules([])
            try { localStorage.removeItem('module_visibility_snapshot') } catch { /* */ }
        }
    }, [])

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isHRUser,
            isHRManager,
            isManager,
            myEmployee,
            scopeLevel,
            isAdmin,
            isSalesUser,
            isSalesRepsUser,
            isCashier,
            isCashierSupervisor,
            isCashierManager,
            isCompanyAdmin,
            moduleAccess,
            availableModules,
            tenantType,
            hrFingerprintOnly,
            hideAdminCards,
            companyInfo,
            activeCompany,
            switchCompany,
            isLoading,
            login,
            logout,
            refreshUser,
            error
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

/**
 * Safe version of useAuth that doesn't throw when used outside AuthProvider.
 * Returns null values instead — useful for shared components like Header
 * that may render on pages without AuthProvider.
 */
export function useAuthSafe() {
    const context = useContext(AuthContext)
    return context ?? {
        user: null,
        isAuthenticated: false,
        isHRUser: false,
        isHRManager: false,
        isManager: false,
        myEmployee: null,
        scopeLevel: 'employee',
        isAdmin: false,
        isSalesUser: false,
        isSalesRepsUser: false,
        isCashier: false,
        isCashierSupervisor: false,
        isCashierManager: false,
        isCompanyAdmin: false,
        moduleAccess: { admin: false, hr: false, sales: false, salesReps: false, purchases: false, inventory: false, cashier: false, accounting: false, tasks: false, realEstate: false, rentals: false } as UserModuleAccess,
        availableModules: [] as string[],
        tenantType: '',
        hrFingerprintOnly: false,
        hideAdminCards: false,
        companyInfo: { company: null, isAdmin: false, allCompanies: [], employee: null },
        activeCompany: null,
        switchCompany: () => { },
        isLoading: false,
        login: async () => false,
        logout: async () => { },
        refreshUser: async () => { },
        error: null,
    }
}
