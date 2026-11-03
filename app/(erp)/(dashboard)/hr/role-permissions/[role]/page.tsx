'use client'

import { use } from 'react'
import { RolePermissionsPage } from '@/components/hr/role-permissions-page'

/**
 * /hr/role-permissions/<role> — Apex «تعديل الصلاحيات» full-page editor.
 * HrShell/HrGuard already enforce auth + HR access.
 */
export default function Page({ params: paramsPromise }: { params: Promise<{ role: string }> }) {
  const params = use(paramsPromise)
  return <RolePermissionsPage role={decodeURIComponent(params.role)} />
}
