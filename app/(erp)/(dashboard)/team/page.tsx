/**
 * «المستخدمين» — Apex list screen inside the unified HR shell (HrGuard owns the gate).
 * Columns and toolbar mirror the reference; rows come from base_meena.api.hr_lists.
 */

'use client'

import { GenericListPage } from '@/components/hr/generic-list-page'
import { getModuleConfig, type ListModuleConfig } from '@/lib/hr-modules'

export default function Page() {
  return <GenericListPage config={getModuleConfig('users') as ListModuleConfig} />
}
