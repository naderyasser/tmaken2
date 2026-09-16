'use client'

import { RequestsTabsPage } from '@/components/hr/requests-tabs-page'

// «الطلبات» — Apex tabs over leaves / permissions / fingerprint requests.
// Mounted inside <HrShell> by the dashboard layout (SHELL_PREFIXES).
export default function RequestsPage() {
  return <RequestsTabsPage />
}
