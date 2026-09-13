'use client'

import { RequestsHub } from '@/components/requests/requests-hub'

// Mounted inside <HrShell> by the dashboard layout (SHELL_PREFIXES). Listed in
// SHELL_NON_HR_PREFIXES so any authenticated employee can reach their own
// requests; the Team tab inside the hub is gated to managers/HR.
export default function RequestsPage() {
  return <RequestsHub />
}
