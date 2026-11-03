/**
 * «أوقات العمل» — Apex list screen inside the unified HR shell (HrGuard owns the gate).
 * Bespoke ShiftListPage (not GenericListPage) — see its file header for why.
 */

'use client'

import { ShiftListPage } from '@/components/hr/shift-list-page'

export default function Page() {
  return <ShiftListPage />
}
