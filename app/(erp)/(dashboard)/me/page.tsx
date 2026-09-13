import { MeDashboard } from '@/components/me/me-dashboard'

// F11 — self-service home. Mounted in the Jisr shell (requireHR=false via
// SHELL_NON_HR_PREFIXES), so plain employees can reach it too.
export default function MePage() {
  return <MeDashboard />
}
