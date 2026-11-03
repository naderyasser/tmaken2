/**
 * «الاجهزة» — bespoke fingerprint-device management screen inside the unified HR shell
 * (HrGuard owns the gate). Registration, status, sync logs and device-ID↔employee
 * mapping all live in DevicesPage — see components/hr/devices-page.tsx.
 */

'use client'

import { DevicesPage } from '@/components/hr/devices-page'

export default function Page() {
  return <DevicesPage />
}
