'use client'

import React from 'react'
import { Providers } from '../providers'
import { Toaster } from '@/components/ui/toaster'
import { FreelancerShell } from '@/components/freelancer/freelancer-shell'

/**
 * Top-level Freelancer Workspace layout.
 *
 * This is a DETACHED area: it deliberately lives OUTSIDE the (erp) route group, so
 * it does NOT inherit the company ERP chrome (Header + Sidebar). Because the (erp)
 * layout is the one that mounts the shared client Providers (I18nProvider +
 * AuthProvider/frappeClient) and the Radix Toaster, we mount them here ourselves so
 * the freelancer routes have i18n, auth and toasts — but render our own dedicated
 * freelancer navigation via <FreelancerShell> instead of the ERP Sidebar.
 */
export default function FreelancerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <FreelancerShell>{children}</FreelancerShell>
      <Toaster />
    </Providers>
  )
}
