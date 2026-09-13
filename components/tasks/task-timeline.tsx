'use client'

import type { WorkflowTask } from '@/lib/task-api'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Circle, Clock, XCircle, AlertTriangle,
  ArrowDown, FileText
} from 'lucide-react'

const L = {
  en: {
    new: 'New', inProgress: 'In Progress', completed: 'Completed',
    cancelled: 'Cancelled', overdue: 'Overdue',
    noTasks: 'No task chain found for this document',
    taskChain: 'Task Chain',
  },
  ar: {
    new: 'جديد', inProgress: 'قيد التنفيذ', completed: 'مكتمل',
    cancelled: 'ملغي', overdue: 'متأخر',
    noTasks: 'لا توجد سلسلة مهام لهذا المستند',
    taskChain: 'سلسلة المهام',
  }
}

const statusIcon: Record<string, { icon: React.ReactNode; color: string; line: string }> = {
  New:           { icon: <Circle className="h-5 w-5" />, color: 'text-blue-500', line: 'bg-blue-200' },
  'In Progress': { icon: <Clock className="h-5 w-5" />, color: 'text-amber-500', line: 'bg-amber-200' },
  Completed:     { icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-green-500', line: 'bg-green-200' },
  Cancelled:     { icon: <XCircle className="h-5 w-5" />, color: 'text-gray-400', line: 'bg-gray-200' },
  Overdue:       { icon: <AlertTriangle className="h-5 w-5" />, color: 'text-red-500', line: 'bg-red-200' },
}

interface TaskTimelineProps {
  tasks: WorkflowTask[]
  lang: 'en' | 'ar'
  isRTL: boolean
  onTaskClick?: (task: WorkflowTask) => void
}

export function TaskTimeline({ tasks, lang, isRTL, onTaskClick }: TaskTimelineProps) {
  const t = L[lang]

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mb-2 opacity-30" />
        <p className="text-sm">{t.noTasks}</p>
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="relative">
      <div className="space-y-0">
        {tasks.map((task, index) => {
          const config = statusIcon[task.status] || statusIcon.New
          const isLast = index === tasks.length - 1
          const statusKey = task.status === 'In Progress' ? 'inProgress' : task.status.toLowerCase()

          return (
            <div key={task.name} className="relative flex gap-4">
              {/* Timeline line + icon */}
              <div className="flex flex-col items-center">
                <div className={cn('rounded-full p-1 bg-white border-2 z-10', config.color, `border-current`)}>
                  {config.icon}
                </div>
                {!isLast && (
                  <div className={cn('w-0.5 flex-1 min-h-[40px]', config.line)} />
                )}
              </div>

              {/* Task detail */}
              <div
                className={cn(
                  'flex-1 pb-6 cursor-pointer group',
                  isLast && 'pb-0'
                )}
                onClick={() => onTaskClick?.(task)}
              >
                <div className={cn(
                  'rounded-lg border p-3 transition-all',
                  'group-hover:shadow-md group-hover:border-primary/30',
                  task.status === 'Overdue' && 'border-red-200 bg-red-50/50',
                  task.status === 'Completed' && 'border-green-200 bg-green-50/30',
                )}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-medium text-sm line-clamp-1">{task.title}</h4>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', {
                      'bg-blue-100 text-blue-700': task.status === 'New',
                      'bg-amber-100 text-amber-700': task.status === 'In Progress',
                      'bg-green-100 text-green-700': task.status === 'Completed',
                      'bg-gray-100 text-gray-500': task.status === 'Cancelled',
                      'bg-red-100 text-red-700': task.status === 'Overdue',
                    })}>
                      {t[statusKey as keyof typeof t] || task.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {task.assigned_to && (
                      <span>{(task as any).assignee_name || task.assigned_to}</span>
                    )}
                    {task.source_document && (
                      <span className="font-mono">{task.source_document}</span>
                    )}
                    {task.completed_date && (
                      <span className="text-green-600">
                        {new Date(task.completed_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Target document (result) */}
                  {task.target_document && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
                      <ArrowDown className="h-3 w-3" />
                      <span className="font-mono">{task.target_doctype}: {task.target_document}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
