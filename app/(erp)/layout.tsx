import React from 'react'
import { Toaster } from '@/components/ui/toaster'
import { Providers } from '../providers'
import { TenantGate } from '@/components/tenant-gate'
import { BrandWarmup } from '@/components/brand-warmup'
import { WalkthroughSession } from '@/components/walkthrough-session'

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
 */
export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <TenantGate />
      <BrandWarmup />
      <WalkthroughSession />
      {children}
      <Toaster />
    </Providers>
  )
}
