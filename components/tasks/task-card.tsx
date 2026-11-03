'use client'

import { cn } from '@/lib/utils'
import type { WorkflowTask } from '@/lib/task-api'
import {
  Clock, AlertTriangle, User, Calendar, ArrowRight,
  Boxes, Truck, Users, Briefcase, Calculator, Shield
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const L = {
  en: {
    new: 'New', inProgress: 'In Progress', completed: 'Completed',
    cancelled: 'Cancelled', overdue: 'Overdue',
    low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
    dueDate: 'Due', autoTask: 'Auto',
    inventory: 'Inventory', purchases: 'Purchases', sales: 'Sales',
    hr: 'HR', accounting: 'Accounting', admin: 'Admin',
    unassigned: 'Unassigned',
  },
  ar: {
    new: 'جديد', inProgress: 'قيد التنفيذ', completed: 'مكتمل',
    cancelled: 'ملغي', overdue: 'متأخر',
    low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل',
    dueDate: 'الاستحقاق', autoTask: 'تلقائي',
    inventory: 'المخزون', purchases: 'المشتريات', sales: 'المبيعات',
    hr: 'الموارد البشرية', accounting: 'المحاسبة', admin: 'الإدارة',
    unassigned: 'غير معين',
  }
}

const priorityConfig = {
  Low:    { color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  Medium: { color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  High:   { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  Urgent: { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
}

const statusConfig = {
  New:           { color: 'bg-blue-500', ring: 'ring-blue-200' },
  'In Progress': { color: 'bg-amber-500', ring: 'ring-amber-200' },
  Completed:     { color: 'bg-green-500', ring: 'ring-green-200' },
  Cancelled:     { color: 'bg-gray-400', ring: 'ring-gray-200' },
  Overdue:       { color: 'bg-red-500', ring: 'ring-red-200' },
}

const moduleIcons: Record<string, React.ReactNode> = {
  Inventory:  <Boxes className="h-3.5 w-3.5" />,
  Purchases:  <Truck className="h-3.5 w-3.5" />,
  Sales:      <Users className="h-3.5 w-3.5" />,
  HR:         <Briefcase className="h-3.5 w-3.5" />,
  Accounting: <Calculator className="h-3.5 w-3.5" />,
  Admin:      <Shield className="h-3.5 w-3.5" />,
}

interface TaskCardProps {
  task: WorkflowTask & { assignee_name?: string }
  lang: 'en' | 'ar'
  onClick?: () => void
  compact?: boolean
}

export function TaskCard({ task, lang, onClick, compact }: TaskCardProps) {
  const t = L[lang]
  const priority = priorityConfig[task.priority] || priorityConfig.Medium
  const status = statusConfig[task.status] || statusConfig.New

  const priorityLabel = t[task.priority.toLowerCase() as keyof typeof t] || task.priority
  const moduleLabel = t[task.module.toLowerCase() as keyof typeof t] || task.module

  const isOverdue = task.status === 'Overdue'
  // Compare dates only (timezone-safe: strip time part)
  const isDue = task.due_date && (() => {
    const dueStr = task.due_date!.slice(0, 10)
    const todayStr = new Date().toISOString().slice(0, 10)
    return dueStr <= todayStr && task.status !== 'Completed'
  })()

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border bg-white p-3 shadow-sm transition-all cursor-pointer',
        'hover:shadow-md hover:border-primary/30',
        isOverdue && 'border-red-300 bg-red-50/50',
        compact && 'p-2'
      )}
    >
      {/* Header: Priority + Module */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', priority.dot)} />
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', priority.color)}>
            {priorityLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          {moduleIcons[task.module]}
          <span className="text-[10px] font-medium">{moduleLabel}</span>
        </div>
      </div>

      {/* Title */}
      <h4 className={cn(
        'font-medium text-sm leading-snug mb-1.5 line-clamp-2',
        compact && 'text-xs line-clamp-1'
      )}>
        {task.title}
      </h4>

      {/* Source document link */}
      {task.source_document && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <ArrowRight className="h-3 w-3" />
          <span className="font-mono truncate">{task.source_document}</span>
        </div>
      )}

      {/* Footer: Assignee + Due date */}
      {!compact && (
        <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-dashed">
          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {task.assignee_name || task.assigned_to || t.unassigned}
            </span>
          </div>
          {task.due_date && (
            <div className={cn(
              'flex items-center gap-1 text-xs shrink-0',
              isDue ? 'text-red-600 font-medium' : 'text-muted-foreground'
            )}>
              {isDue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              <span>{new Date(task.due_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      )}

      {/* Auto-created indicator */}
      {task.assigned_by_system && (
        <div className="absolute top-1 ltr:right-1 rtl:left-1">
          <span className="text-[9px] bg-primary/10 text-primary px-1 rounded font-medium">
            {t.autoTask}
          </span>
        </div>
      )}
    </div>
  )
}
