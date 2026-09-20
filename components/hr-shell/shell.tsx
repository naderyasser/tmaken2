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
 * Layout (verified against the live reference, not assumed): the sidebar is
 * a FULL-HEIGHT column from the very top of the viewport — it does not start
 * below the topbar. The topbar is a narrower bar that only spans the content
 * column beside it (Apex\'s own mat-toolbar measures ~1215px wide against a
 * ~1505px viewport with a 272px sidebar — it never extends behind the rail).
 * So: [sidebar (full height)] | [topbar, then main] stacked in the remaining
 * column — not one full-width topbar sitting above a second [sidebar, main] row.
 */
export function HrShell({ requireHR = true, children }: { requireHR?: boolean; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Test round 4 correction A: Radix portals (dialog/alertdialog/tooltip/
  // popover/toast) render to document.body by default, which is NOT a
  // descendant of the `.theme-hr` div below — so their `--apex-*`/font
  // overrides in globals.css never applied (dialogs rendered IBM Plex 13px/
  // 700, «حفظ» was transparent since --apex-green is undefined outside
  // .theme-hr). Toggling the class on <body> too — kept alongside the
  // existing wrapper div, not instead of it — makes every portaled surface a
  // real descendant of `.theme-hr` for the CSS cascade.
  useEffect(() => {
    document.body.classList.add('theme-hr')
    return () => { document.body.classList.remove('theme-hr') }
  }, [])

  return (
    <div
      className="theme-hr flex h-screen overflow-hidden bg-[var(--apex-canvas)] text-foreground"
      dir="rtl"
    >
      <HrGuard requireHR={requireHR}>
        <Suspense fallback={null}>
          <FingerprintRouteGuard />
        </Suspense>

        {/* Sidebar — full height, independent of the topbar */}
        <Suspense fallback={<div className="hidden lg:block w-[272px] bg-[#2960b6] shrink-0" />}>
          <IconRail />
        </Suspense>

        {/* Remaining column: topbar (content-width only) then main */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

          {/* S8: page canvas #fbfbfb, content padding-top 10px */}
          <main className="flex-1 overflow-y-auto bg-[var(--apex-canvas)] pt-[10px]">
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
