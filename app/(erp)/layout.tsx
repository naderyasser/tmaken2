import React from 'react'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { Providers } from '../providers'
import { TenantGate } from '@/components/tenant-gate'
import { BrandWarmup } from '@/components/brand-warmup'

/**
 * ERP application layout. Holds the client Providers (I18nProvider with the full
 * bilingual dictionary + AuthProvider/frappeClient) and the Radix Toaster — i.e. the
 * heavy app chrome that EVERY authenticated/back-office route needs.
 *
 * Deliberately NOT in the root layout: the public storefront (app/store/**, served at
 * the site root via middleware rewrite) is Arabic-only, fetches on the server, and uses
 * its own lightweight toasts — so it must not pay for the ~40 KB-gz i18n dictionary +
 * frappeClient + Radix Toast on first paint. Scoping them here keeps them off store pages.
 *
 * TenantGate applies tenant flavors (site_config tenant_type): "freelancer" sites
 * are redirected out of the ERP into the standalone /freelancer workspace; "sales"
 * sites are reduced to the sales-reps vertical (/sales-reps + /sales-rep only).
 *
 * The sonner Toaster (2026-09-19, B5 pixel-parity pass) is a SECOND, separate
 * toaster mounted alongside the shared shadcn/Radix one above — HR-shell code
 * (real-login-form.tsx's forgot-password flow, and future HR toasts) calls
 * sonner's `toast()` directly to get Apex's mat-snack-bar look (top-center,
 * short duration, green success) without touching the shared `use-toast`
 * plumbing every other vertical already depends on. `className="theme-hr"` is
 * applied straight to the Toaster's own root so the `.theme-hr [data-sonner-…]`
 * CSS in globals.css always matches it regardless of where sonner portals it —
 * it stays an inert, invisible container on every non-HR route since nothing
 * outside the HR shell calls sonner's toast().
 */
export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <TenantGate />
      <BrandWarmup />
      {children}
      <Toaster />
      {/* components/ui/sonner.tsx spreads `{...props}` LAST, after its own
          `className="toaster group"` — passing just "theme-hr" here would
          overwrite (not merge with) those two classes and break every
          `toastOptions.classNames` selector that targets `.group-[.toaster]`,
          so both must be repeated explicitly. */}
      <SonnerToaster className="toaster group theme-hr" position="top-center" />
    </Providers>
  )
}
