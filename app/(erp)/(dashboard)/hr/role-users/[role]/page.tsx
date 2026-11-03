'use client'

import { use } from 'react'
import { RoleUsersPage } from '@/components/hr/role-users-page'

/** /hr/role-users/<role> — Apex «الصلاحيات / المستخدمين». */
export default function Page({ params: paramsPromise }: { params: Promise<{ role: string }> }) {
  const params = use(paramsPromise)
  return <RoleUsersPage role={decodeURIComponent(params.role)} />
}
