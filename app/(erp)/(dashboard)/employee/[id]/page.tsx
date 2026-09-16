'use client'

import { use } from 'react'
import { ApexEmployeeForm } from '@/components/hr/apex-employee-form'

/**
 * /employee/new and /employee/<id> — the Apex full-page employee form.
 * HrShell/HrGuard already enforce auth + HR access.
 */
export default function EmployeeProfilePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  return <ApexEmployeeForm employeeId={params.id === 'new' ? undefined : decodeURIComponent(params.id)} />
}
