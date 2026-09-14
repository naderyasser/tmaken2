'use client'

import { useState, useEffect, Suspense, type ReactNode } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { HrGuard } from './hr-guard'
import { IconRail } from './icon-rail'
import { Topbar } from './topbar'
import { MobileNav } from './mobile-nav'
import { isFingerprintRoute, FINGERPRINT_HOME } from './routes'

function FingerprintRouteGuard() {
  const { hrFingerprintOnly } = useAuth()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const moduleParam = searchParams.get('module')
  const router = useRouter()

  useEffect(() => {
    if (!hrFingerprintOnly) return
    if (isFingerprintRoute(pathname, moduleParam)) return
    router.replace(FINGERPRINT_HOME)
  }, [hrFingerprintOnly, pathname, moduleParam, router])

  return null
}

function PageEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  return (
    <div key={pathname} className="hr-page-enter h-full">
      {children}
    </div>
  )
}

/**
 * Apex ERP-styled shell.
 * Layout: full-height, RTL, two-row Topbar spanning full width (brand/user +
 * breadcrumb/company/search/fiscal), then Sidebar (right) + main content (left).
 */
export function HrShell({ requireHR = true, children }: { requireHR?: boolean; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div
      className="theme-hr flex flex-col h-screen overflow-hidden bg-[#f4f5f7] text-foreground"
      dir="rtl"
    >
      <HrGuard requireHR={requireHR}>
        <Suspense fallback={null}>
          <FingerprintRouteGuard />
        </Suspense>

        {/* Two-row topbar (brand/user + breadcrumb/company/search/fiscal) */}
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        {/* Body: sidebar + main */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar on the right (RTL) */}
          <Suspense fallback={<div className="hidden lg:block w-[272px] bg-[#2960b6] shrink-0" />}>
            <IconRail />
          </Suspense>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <PageEnter>{children}</PageEnter>
          </main>
        </div>

        <Suspense fallback={null}>
          <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        </Suspense>
      </HrGuard>
    </div>
  )
}
