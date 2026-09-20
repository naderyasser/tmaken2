'use client'

import { MoreVertical } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type RowMenuProps = {
  kind: 'employee' | 'master'
  onView: () => void
  onActivate?: () => void
  onDeactivate?: () => void
  isActive?: boolean
  onHistory?: () => void
}

/**
 * Apex row «⋮» menu — employee-kind lists (employees/jobs/unregistered) get
 * «عرض» + «تنشيط»/«إلغاء التنشيط» (whichever applies); master-kind lists
 * (branches/shifts/nationality/leave-types/devices/projects/tasks/groups)
 * get «عرض» + «سجل الحركات». Activation items only render when the caller
 * actually wired a backing status field (see hr_lists.set_active) — a
 * doctype with none simply shows «عرض» alone.
 */
export function RowMenu({ kind, onView, onActivate, onDeactivate, isActive, onHistory }: RowMenuProps) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="خيارات"
          aria-label="خيارات"
          className="apex-icon-more rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--apex-blue)] focus-visible:ring-offset-1"
        >
          <MoreVertical className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px] text-[13px]">
        <DropdownMenuItem onClick={onView}>عرض</DropdownMenuItem>
        {kind === 'employee' && isActive !== undefined && (
          isActive
            ? onDeactivate && <DropdownMenuItem onClick={onDeactivate}>إلغاء التنشيط</DropdownMenuItem>
            : onActivate && <DropdownMenuItem onClick={onActivate}>تنشيط</DropdownMenuItem>
        )}
        {kind === 'master' && onHistory && (
          <DropdownMenuItem onClick={onHistory}>سجل الحركات</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
