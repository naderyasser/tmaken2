/**
 * «الصلاحيات» — Apex bespoke screen inside the unified HR shell (HrGuard
 * owns the gate). Dispatched through ModulePage('permissions') — see
 * components/hr/permissions-list-page.tsx for the Apex-exact columns/toolbar
 * (5.17). The per-role matrix still lives at /hr/role-permissions/[role]
 * (components/hr/role-permissions-page.tsx, unchanged).
 */

'use client'

import { ModulePage } from '@/components/hr/module-page'

export default function Page() {
  return <ModulePage moduleId="permissions" />
}
