'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { DynamicTitle } from '@/components/dynamic-title'
// Jisr-style neutral-airy retheme of `.theme-hr` (see the file header). Imported
// here because this layout is what applies `.theme-hr` to HR routes. Unlayered,
// so it overrides the cream `.theme-hr` block in globals.css.
import '../../styles/theme-hr-airy.css'
// Motion & smoothness layer — premium easing, press feedback, focus rings,
// entrance/shimmer animations, quiet scrollbars. Scoped to `.theme-hr`, fully
// disabled under prefers-reduced-motion. Imported AFTER the theme so its tokens
// (--ease-*, --dur-*) resolve against the airy palette.
import '../../styles/hr-motion.css'
import { HrShell } from '@/components/hr-shell/shell'
import { matchesShell, shellRequiresHR } from '@/components/hr-shell/routes'
import { EgarsysReturnButton } from '@/components/egarsys-return-button'

/**
 * Dashboard route group layout.
 *
 * HR routes mount the unified Jisr shell (HrShell — icon rail + top bar +
 * HrGuard + `.theme-hr`) via SHELL_PREFIXES. A few HR-adjacent routes still keep
 * legacy per-page chrome and only get the airy `.theme-hr` tokens.
 *
 * EXCEPTION — the bare `/hr` dashboard surface (and `/hr?module=dashboard`) is the
 * public, guest-accessible "Tamkeen proposed version" mock: it renders its own
 * full-screen chrome and dummy data, so it bypasses HrShell/HGuard entirely. Every
 * other `/hr?module=…` module surface keeps the authenticated shell.
 */
const HR_ROUTE_PREFIXES = ['/hr-settings', '/tasks']

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const moduleParam = searchParams.get('module')

  if (matchesShell(pathname)) {
    // Migrated HR routes → the Jisr shell. `/team` (Company-Admin) gets the shell
    // WITHOUT the HR-user gate (the page enforces its own Company-Admin access).
    return <HrShell requireHR={shellRequiresHR(pathname)}>{children}</HrShell>
  }

  if (HR_ROUTE_PREFIXES.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    // Not-yet-migrated HR-adjacent routes keep their own chrome but get `.theme-hr` tokens.
    return <div className="theme-hr min-h-screen bg-background text-foreground">{children}</div>
  }

  return <>{children}</> // non-HR verticals: bare
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Per-route document.title (searchParams read → its own Suspense boundary). */}
      <Suspense fallback={null}>
        <DynamicTitle />
      </Suspense>
      {/* Chrome selection reads `?module=` → wrapped in its own Suspense boundary. */}
      <Suspense fallback={null}>
        <Chrome>{children}</Chrome>
      </Suspense>
      {/* Mounted HERE, not per-page: the assistant must follow the user across
          every dashboard route. It used to live only inside /me, so anyone who
          navigated away lost it and couldn't find it again. Self-hides when the
          tenant/role isn't eligible. */}
      {/* tamkeen-v2 is an exact Apex copy — no floating assistant on this build. */}
      {/* Follows the user across every dashboard page, but ONLY for sessions
          opened from egarsys (cookie-gated inside the component). */}
      <EgarsysReturnButton />
    </>
  )
}
