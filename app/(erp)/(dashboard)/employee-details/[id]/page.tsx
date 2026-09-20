"use client"

import { use } from "react"
import { EmployeeViewPage } from "@/components/hr/employee-view-page"

// Auth + HR gate handled by HrShell/HrGuard (this route is in SHELL_PREFIXES).
export default function EmployeeDetailsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  return <EmployeeViewPage employeeId={params.id} />
}
