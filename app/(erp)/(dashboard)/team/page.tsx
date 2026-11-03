/**
 * «المستخدمين» — Apex bespoke screen inside the unified HR shell (HrGuard
 * owns the gate). Dispatched through ModulePage('users') — see
 * components/hr/users-page.tsx for the Apex-exact columns/toolbar (5.16).
 */

'use client'

import { ModulePage } from '@/components/hr/module-page'

export default function Page() {
  return <ModulePage moduleId="users" />
}
