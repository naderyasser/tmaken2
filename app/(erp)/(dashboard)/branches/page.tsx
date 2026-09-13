'use client'

import { BranchManagement } from '@/components/branch/branch-management'

export default function BranchesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BranchManagement />
      </div>
    </div>
  )
}
