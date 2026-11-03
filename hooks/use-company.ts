'use client'

import { useAuth, useAuthSafe } from '@/lib/auth-context'

/**
 * Hook to get the current active company and company switching ability.
 * 
 * - For regular users: returns their assigned company (from Employee doctype).
 * - For admins: returns all companies + ability to switch.
 * - `activeCompany` is the currently selected company for filtering data.
 */
export function useCompany() {
    const { companyInfo, activeCompany, switchCompany, isAdmin } = useAuth()

    return {
        /** The user's own company (from Employee record) */
        userCompany: companyInfo.company,
        /** The currently active company (for filtering). Admin can switch this. */
        company: activeCompany,
        /** Whether the user is admin (can see all companies) */
        isAdmin: companyInfo.isAdmin || isAdmin,
        /** List of all companies (populated only for admins) */
        allCompanies: companyInfo.allCompanies,
        /** The user's employee ID */
        employee: companyInfo.employee,
        /** Switch the active company (admin only). Pass null to see all. */
        switchCompany,
    }
}

/**
 * Safe version that doesn't throw outside AuthProvider.
 */
export function useCompanySafe() {
    const { companyInfo, activeCompany, switchCompany, isAdmin } = useAuthSafe()

    return {
        userCompany: companyInfo.company,
        company: activeCompany,
        isAdmin: companyInfo.isAdmin || isAdmin,
        allCompanies: companyInfo.allCompanies,
        employee: companyInfo.employee,
        switchCompany,
    }
}
