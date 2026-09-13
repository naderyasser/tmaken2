/**
 * Employees Page — renders inside the unified Jisr shell (HrShell mounted by
 * the dashboard layout; HrGuard owns the auth/HR gate).
 */

'use client'

import { useRouter } from 'next/navigation'
import { EmployeesList } from '@/components/employee/employees-list'
import type { Employee } from '@/lib/api-client'

export default function EmployeesPage() {
    const router = useRouter()

    const handleEmployeeSelect = (employee: Employee) => {
        const path = `/employee/${encodeURIComponent(employee.name)}`
        try {
            router.push(path)
        } catch {
            window.location.href = path
        }
    }

    const handleAddEmployee = () => {
        router.push('/employee/new')
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <EmployeesList
                onEmployeeSelect={handleEmployeeSelect}
                onAddEmployee={handleAddEmployee}
            />
        </div>
    )
}
