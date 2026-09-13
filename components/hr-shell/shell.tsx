'use client'

import { useState, useEffect, Suspense, type ReactNode } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { HrGuard } from './hr-guard'
import { IconRail } from './icon-rail'
import { Topbar } from './topbar'
import { MobileNav } from './mobile-nav'
import { isFingerprintRoute, FINGERPRINT_HOME } from './routes'

/**
 * Fingerprint-only route guard. A tenant on the biometric/attendance HR plan
 * (hr_fingerprint_only flag) may only sit on the fingerprint bundle routes within
 * HR; any other HR URL entered directly (e.g. /payroll or /hr?module=leaves) is
 * bounced to /biometric. No-op unless the flag is set. This trims HR only — the
 * tenant's other modules are unaffected. Reads `?module=` (same as the rail) —
 * rendered inside a Suspense boundary so it doesn't force the whole shell out of
 * static rendering.
 */
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

/**
 * Re-mounts (via `key`) on every route change so the page content re-plays the
 * `hr-page-enter` fade+rise. Keyed on pathname ONLY — not on `?module=` — so the
 * /hr in-page module switcher keeps its state and doesn't refetch on each tab.
 */
function PageEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  return (
    <div key={pathname} className="hr-page-enter h-full">
      {children}
    </div>
  )
}

/**
 * The Jisr-style HR shell — mounted from app/(erp)/(dashboard)/layout.tsx for
 * routes in SHELL_PREFIXES. Applies `.theme-hr` itself (so self-service routes
 * outside the dashboard group can mount it directly), sets `dir`, guards access,
 * and composes [IconRail | (Topbar, main)]. Layout-level mount = chrome persists
 * across HR navigations. `requireHR={false}` for employee self-service.
 *
 * IconRail + MobileNav read `?module=`, so each is wrapped in Suspense.
 */
export function HrShell({ requireHR = true, children }: { requireHR?: boolean; children: ReactNode }) {
  const { isRTL } = useI18n()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="theme-hr min-h-screen bg-background text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      <HrGuard requireHR={requireHR}>
        <Suspense fallback={null}>
          <FingerprintRouteGuard />
        </Suspense>
        <div className="flex h-screen overflow-hidden">
          <Suspense fallback={<div className="hidden lg:block w-[264px] border-e border-border shrink-0" />}>
            <IconRail />
          </Suspense>
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
            <main className="flex-1 overflow-y-auto">
              <PageEnter>{children}</PageEnter>
            </main>
          </div>
        </div>
        <Suspense fallback={null}>
          <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        </Suspense>
      </HrGuard>
    </div>
  )
}
