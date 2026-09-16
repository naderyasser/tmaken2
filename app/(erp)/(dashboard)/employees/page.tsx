/**
 * «الموظفين» — Apex list (رقم · اسم الموظف · الوظيفة · فرع · الدوام · الحالة)
 * inside the unified HR shell. Add/edit open the full-page employee form.
 */

'use client'

import { GenericListPage } from '@/components/hr/generic-list-page'
import { getModuleConfig, type ListModuleConfig } from '@/lib/hr-modules'

export default function EmployeesPage() {
  return <GenericListPage config={getModuleConfig('employees') as ListModuleConfig} />
}
