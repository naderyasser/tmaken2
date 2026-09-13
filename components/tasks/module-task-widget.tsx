'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { taskApi, type ModuleTaskSummary } from '@/lib/task-api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ClipboardList, AlertTriangle, Clock, CheckCircle2, ArrowRight, ArrowLeft
} from 'lucide-react'

const L = {
  en: {
    pendingTasks: 'Pending Tasks',
    open: 'Open',
    overdue: 'Overdue',
    completedToday: 'Done Today',
    viewAll: 'View All Tasks',
    noTasks: 'No pending tasks',
  },
  ar: {
    pendingTasks: 'المهام المعلقة',
    open: 'مفتوحة',
    overdue: 'متأخرة',
    completedToday: 'مكتملة اليوم',
    viewAll: 'عرض كل المهام',
    noTasks: 'لا توجد مهام معلقة',
  }
}

interface Props {
  module: string
  lang: 'en' | 'ar'
  isRTL: boolean
  className?: string
}

export function ModuleTaskWidget({ module, lang, isRTL, className }: Props) {
  const router = useRouter()
  const t = L[lang]
  const [summary, setSummary] = useState<ModuleTaskSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    taskApi.getModuleTaskSummary(module)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [module])

  if (loading) {
    return (
      <div className={cn('rounded-xl border bg-white p-4 animate-pulse', className)}>
        <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
        <div className="flex gap-3">
          <div className="h-10 w-16 bg-gray-100 rounded" />
          <div className="h-10 w-16 bg-gray-100 rounded" />
          <div className="h-10 w-16 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!summary || (summary.open === 0 && summary.overdue === 0 && summary.completed_today === 0)) {
    return null // Don't show widget if no tasks for this module
  }

  return (
    <div className={cn('rounded-xl border bg-white p-4', className)} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-semibold">{t.pendingTasks}</span>
        </div>
        <button
          onClick={() => router.push(`/tasks?module=${module}`)}
          className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
        >
          {t.viewAll}
          {isRTL ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
        </button>
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-lg font-bold">{summary.open}</span>
          <span className="text-xs text-muted-foreground">{t.open}</span>
        </div>
        {summary.overdue > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-lg font-bold text-red-600">{summary.overdue}</span>
            <span className="text-xs text-muted-foreground">{t.overdue}</span>
          </div>
        )}
        {summary.completed_today > 0 && (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-lg font-bold text-green-600">{summary.completed_today}</span>
            <span className="text-xs text-muted-foreground">{t.completedToday}</span>
          </div>
        )}
      </div>
    </div>
  )
}
