'use client'

// «الموارد البشرية» — embeds the platform's OWN HR landing dashboard
// (employees / payroll / analytics) inside the egarsys rentals shell, WITHOUT
// redirecting to the standalone /hr route.
//
// What it mounts: <HRDashboard> — the exact content the platform renders at /hr
// (KPIs, HR-intelligence, workforce/leadership analytics, payroll audit, recent
// employees, quick actions). We deliberately do NOT mount <HrShell>: that wrapper
// only adds chrome we already have or don't want here — the icon rail + top bar
// (the egarsys sidebar is the chrome), an HrGuard access gate, and a duplicate
// `.theme-hr`. All the React context HRDashboard actually needs — I18nProvider,
// AuthProvider, the Radix Toaster, and frappeClient — is mounted higher up in
// app/(erp)/layout.tsx, which already wraps this route. So no extra providers.
//
// Styling: this vertical lives under `.egarsys-scope` (green tokens). We wrap the
// HR content in `.theme-hr` so it resolves the platform's HR design tokens (teal
// primary, airy cards) instead of egarsys green. `.theme-hr` is safe to use here
// because app/(erp)/(dashboard)/layout.tsx already imports theme-hr-airy.css +
// hr-motion.css globally for this route group.

import * as React from 'react'
import type { ModuleType } from '@/components/sidebar'
import { HRDashboard } from '@/components/hr-dashboard'

// Map an HR drill-down module → the platform's canonical standalone surface.
// Kept in sync with /hr's own handleModuleChange redirects (salaries → /payroll,
// shifts/shift-management → /shift-management); everything else is a /hr module.
function moduleHref(module: ModuleType): string {
  switch (module) {
    case 'dashboard':
      return '/hr'
    case 'salaries':
      return '/payroll'
    case 'shifts':
    case 'shift-management':
      return '/shift-management'
    default:
      return `/hr?module=${module}`
  }
}

export default function HrSection() {
  // Drill-down clicks (KPI cards, quick actions, "view all", module tiles) must
  // NOT hijack the egarsys shell via router.push — that would navigate the whole
  // app out of the rentals vertical to /hr, which is exactly what this embed
  // avoids. Instead open the real platform HR surface in a NEW tab, leaving the
  // current egarsys shell view intact.
  const handleNavigate = React.useCallback((module: ModuleType) => {
    if (typeof window !== 'undefined') {
      window.open(moduleHref(module), '_blank', 'noopener,noreferrer')
    }
  }, [])

  return (
    <div className="theme-hr min-h-full bg-background text-foreground" dir="rtl">
      <HRDashboard onNavigate={handleNavigate} />
    </div>
  )
}
