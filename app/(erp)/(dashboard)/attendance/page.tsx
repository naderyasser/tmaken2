/**
 * Attendance Page — inside the unified Jisr shell (HrGuard owns the HR gate).
 */

'use client'

import { EmployeeCheckinList } from '@/components/employee/employee-checkin-list'

export default function AttendancePage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <EmployeeCheckinList />
            </div>
        </div>
    )
}
