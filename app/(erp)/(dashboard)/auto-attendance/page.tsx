'use client'

import { AutoAttendanceManagement } from '@/components/attendance/auto-attendance-management'

export default function AutoAttendancePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <AutoAttendanceManagement />
      </div>
    </div>
  )
}
