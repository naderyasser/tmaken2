'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { frappeClient } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'

interface CustodyAlerts {
  pending_count: number
  damaged_count: number
  items: any[]
}

/**
 * Persistent top-of-screen alert banner (GitHub-style) that shows whenever
 * the logged-in employee has custody items awaiting acknowledgement or
 * reported as damaged.
 *
 * Placement: inside the sales-rep layout, before {children}, so it appears
 * at the top of every sales-rep page.
 */
export function CustodyAlertBanner() {
  const { isAuthenticated, user } = useAuth()
  const [alerts, setAlerts] = useState<CustodyAlerts | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return

    async function load() {
      try {
        const res = await frappeClient.call<CustodyAlerts>(
          'base_meena.employee_custody_api.get_custody_alerts'
        )
        setAlerts(res?.message ?? null)
      } catch {
        // Silently fail — bank just won't show
      }
    }

    load()
  }, [isAuthenticated, user?.email])

  if (!alerts || (alerts.pending_count === 0 && alerts.damaged_count === 0)) {
    return null
  }

  return (
    <div
      className="sticky top-0 z-50 flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-300 text-amber-900 text-sm font-medium"
      dir="rtl"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />

      <span className="flex-1 leading-snug">
        {alerts.pending_count > 0 && (
          <span>
            لديك {alerts.pending_count} عهدة بانتظار الاستلام
          </span>
        )}
        {alerts.pending_count > 0 && alerts.damaged_count > 0 && ' · '}
        {alerts.damaged_count > 0 && (
          <span>
            {alerts.damaged_count} عهدة تالفة تحتاج متابعة
          </span>
        )}
      </span>

      <Link
        href="/sales-rep/profile"
        className="shrink-0 flex items-center gap-0.5 text-amber-700 hover:text-amber-900"
      >
        عرض
        <ChevronLeft className="h-4 w-4" />
      </Link>
    </div>
  )
}
