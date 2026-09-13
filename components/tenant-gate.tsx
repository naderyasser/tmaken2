'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

/**
 * Tenant-flavor gate.
 *
 * Sites can declare a flavor via site_config.json `tenant_type` (surfaced by
 * `base_meena.api.permission.get_module_visibility` through the auth context):
 *
 *  - "freelancer": the company ERP is hidden — any authenticated visit to an ERP
 *    route redirects to the standalone /freelancer workspace.
 *  - "sales": sales-only client — the ERP is reduced to the sales-reps vertical.
 *    Only /sales-reps (back office) and /sales-rep/* (rep PWA) are reachable;
 *    every other ERP route redirects to the user's sales landing (managers/admins
 *    → /sales-reps, reps → /sales-rep). The rest of the stack stays installed
 *    underneath (ERPNext is load-bearing) but is not part of the client UI.
 *  - "" / unset: normal full ERP tenant. Renders nothing.
 *
 * To avoid a flash of the ERP module hub before the redirect, this component
 * renders a full-screen splash OVERLAY the moment it knows the tenant has a
 * flavor — covering whatever the ERP page paints underneath while the router
 * navigates away. The decision is made synchronously from a `localStorage`
 * snapshot (written by the auth context on every login), so on any repeat visit
 * the overlay is up on first paint with zero flash.
 *
 * Mounted inside the (erp) layout only. The /freelancer area is a SEPARATE
 * top-level route group (its own layout), so it never mounts this gate — no
 * redirect loop. The sales routes ARE inside (erp), so they're exempted below.
 */

/** Routes a "sales" tenant may use inside the (erp) group. */
const SALES_ALLOWED_PREFIXES = ['/sales-rep', '/sales-reps', '/login']

function onSalesRoute(pathname: string) {
  return SALES_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export function TenantGate() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { tenantType, isAuthenticated, isLoading, isAdmin, user } = useAuth()

  // Synchronous best-guess from the persisted snapshot so the overlay can be up
  // on the very first paint (before the async auth fetch resolves tenantType).
  const [snapshot, setSnapshot] = useState<string>('')
  useEffect(() => {
    try { setSnapshot(localStorage.getItem('tenant_type') || '') } catch { /* */ }
  }, [])

  const flavor = tenantType || snapshot
  const isFreelancerTenant = flavor === 'freelancer'
  const isSalesTenant = flavor === 'sales'

  // Sales landing: back-office users get the dashboard, reps get the PWA.
  const SALES_ROLES = ['Sales User', 'Salesman', 'Sales Manager', 'Sales Master Manager']
  const isSalesUser = user?.roles?.some((r) => SALES_ROLES.includes(r)) ?? false
  const isSalesBackOffice =
    isAdmin || (user?.roles?.some((r) => ['Sales Manager', 'Sales Master Manager'].includes(r)) ?? false)
  const salesLanding = isSalesBackOffice ? '/sales-reps' : '/sales-rep'

  // A "sales" tenant confines its SALES staff (reps/managers/admins) to the sales
  // area. But the same tenant can also have non-sales staff — e.g. an accountant
  // (enabled_modules adds accounting) — who must NOT be dumped into the rep PWA;
  // they use the normal module hub for their own module. While roles are still
  // loading we keep everyone confined (snapshot-based) so reps never flash the hub.
  const salesConfined = isSalesTenant && (isLoading || isAdmin || isSalesUser)

  const onExemptRoute =
    pathname.startsWith('/login') ||
    (isFreelancerTenant && pathname.startsWith('/freelancer')) ||
    (salesConfined && onSalesRoute(pathname))

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    if (onExemptRoute) return
    if (isFreelancerTenant) {
      router.replace('/freelancer')
    } else if (salesConfined) {
      router.replace(salesLanding)
    }
  }, [isFreelancerTenant, salesConfined, salesLanding, isAuthenticated, isLoading, onExemptRoute, router])

  // Cover the ERP page while we redirect (don't cover the login screen itself,
  // and don't cover the sales routes a sales tenant is allowed to use).
  if (pathname.startsWith('/login')) return null
  if (isFreelancerTenant) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FBF8F2]">
        <div className="text-center">
          <div className="w-9 h-9 border-[3px] border-[#0E6E62] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">جاري التحميل…</p>
        </div>
      </div>
    )
  }
  if (salesConfined && !onSalesRoute(pathname)) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-9 h-9 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">جاري التحميل…</p>
        </div>
      </div>
    )
  }
  return null
}
