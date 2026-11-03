'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { taskApi, type WorkflowTask, type TaskLog } from '@/lib/task-api'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Play, UserPlus, Clock, ArrowRight,
  FileText, User, Calendar, AlertTriangle, Loader2,
  Boxes, Truck, Users, Briefcase, Calculator, Shield,
  Hand
} from 'lucide-react'

const L = {
  en: {
    taskDetail: 'Task Detail', close: 'Close',
    status: 'Status', priority: 'Priority', module: 'Module',
    assignee: 'Assignee', dueDate: 'Due Date', source: 'Source Document',
    target: 'Target Document', rule: 'Rule', company: 'Company',
    created: 'Created', completed: 'Completed At', completedBy: 'Completed By',
    description: 'Description', notes: 'Notes', activityLog: 'Activity Log',
    actions: 'Actions',
    markInProgress: 'Start', markComplete: 'Complete', markCancelled: 'Cancel',
    claimTask: 'Claim Task', reassign: 'Reassign',
    addNote: 'Add Note', notePlaceholder: 'Write a note...',
    saveNote: 'Save Note',
    new: 'New', inProgress: 'In Progress', completedStatus: 'Completed',
    cancelled: 'Cancelled', overdue: 'Overdue',
    low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
    inventory: 'Inventory', purchases: 'Purchases', sales: 'Sales',
    hr: 'HR', accounting: 'Accounting', admin: 'Admin',
    autoCreated: 'Auto-created by system',
    loading: 'Loading...',
    noLogs: 'No activity yet',
  },
  ar: {
    taskDetail: 'تفاصيل المهمة', close: 'إغلاق',
    status: 'الحالة', priority: 'الأولوية', module: 'الموديول',
    assignee: 'المسؤول', dueDate: 'تاريخ الاستحقاق', source: 'المستند المصدر',
    target: 'المستند الهدف', rule: 'القاعدة', company: 'الشركة',
    created: 'تاريخ الإنشاء', completed: 'تاريخ الإكمال', completedBy: 'أكمله',
    description: 'الوصف', notes: 'ملاحظات', activityLog: 'سجل النشاط',
    actions: 'الإجراءات',
    markInProgress: 'بدء', markComplete: 'إكمال', markCancelled: 'إلغاء',
    claimTask: 'استلام المهمة', reassign: 'إعادة تعيين',
    addNote: 'إضافة ملاحظة', notePlaceholder: 'اكتب ملاحظة...',
    saveNote: 'حفظ الملاحظة',
    new: 'جديد', inProgress: 'قيد التنفيذ', completedStatus: 'مكتمل',
    cancelled: 'ملغي', overdue: 'متأخر',
    low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل',
    inventory: 'المخزون', purchases: 'المشتريات', sales: 'المبيعات',
    hr: 'الموارد البشرية', accounting: 'المحاسبة', admin: 'الإدارة',
    autoCreated: 'تم إنشاؤها تلقائياً',
    loading: 'جاري التحميل...',
    noLogs: 'لا يوجد نشاط بعد',
  }
}

const statusColors: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-500',
  Overdue: 'bg-red-100 text-red-700',
}

const priorityColors: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Urgent: 'bg-red-100 text-red-700',
}

const moduleIcons: Record<string, React.ReactNode> = {
  Inventory:  <Boxes className="h-4 w-4" />,
  Purchases:  <Truck className="h-4 w-4" />,
  Sales:      <Users className="h-4 w-4" />,
  HR:         <Briefcase className="h-4 w-4" />,
  Accounting: <Calculator className="h-4 w-4" />,
  Admin:      <Shield className="h-4 w-4" />,
}

interface TaskDetailSheetProps {
  taskName: string | null
  open: boolean
  onClose: () => void
  lang: 'en' | 'ar'
  isRTL: boolean
  onRefresh: () => void
  currentUser?: string
}

export function TaskDetailSheet({
  taskName, open, onClose, lang, isRTL, onRefresh, currentUser
}: TaskDetailSheetProps) {
  const t = L[lang]
  const [task, setTask] = useState<WorkflowTask | null>(null)
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [assigneeName, setAssigneeName] = useState('')
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [note, setNote] = useState('')

  const fetchDetail = useCallback(async () => {
    if (!taskName) return
    setLoading(true)
    try {
      const data = await taskApi.getTaskDetail(taskName)
      if (data) {
        setTask(data.task)
        setLogs(data.logs || [])
        setAssigneeName(data.assignee_name || '')
      }
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }, [taskName])

  useEffect(() => {
    if (open && taskName) fetchDetail()
  }, [open, taskName, fetchDetail])

  const handleAction = async (action: string) => {
    if (!task) return
    setActing(true)
    try {
      if (action === 'claim') {
        await taskApi.claimTask(task.name)
      } else {
        await taskApi.updateTaskStatus(task.name, action, note || undefined)
      }
      setNote('')
      await fetchDetail()
      onRefresh()
    } catch {
      // Error will be shown
    } finally {
      setActing(false)
    }
  }

  const isOpen = task && ['New', 'In Progress', 'Overdue'].includes(task.status)
  const canClaim = task && !task.assigned_to && task.assigned_role

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side={isRTL ? 'left' : 'right'} className="w-[440px] sm:w-[500px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg">{t.taskDetail}</SheetTitle>
          <SheetDescription className="sr-only">{t.taskDetail}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : task ? (
          <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">
            {/* Title + Auto badge */}
            <div>
              <h3 className="font-semibold text-base leading-snug">{task.title}</h3>
              {task.assigned_by_system && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded mt-1 inline-block">
                  {t.autoCreated}
                </span>
              )}
            </div>

            {/* Status + Priority + Module */}
            <div className="flex flex-wrap gap-2">
              <Badge className={cn(statusColors[task.status])} variant="secondary">
                {(() => {
                  const key = task.status === 'In Progress' ? 'inProgress' : 
                              task.status === 'Completed' ? 'completedStatus' :
                              task.status.toLowerCase()
                  return t[key as keyof typeof t] || task.status
                })()}
              </Badge>
              <Badge className={cn(priorityColors[task.priority])} variant="secondary">
                {t[task.priority.toLowerCase() as keyof typeof t] || task.priority}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                {moduleIcons[task.module]}
                {t[task.module.toLowerCase() as keyof typeof t] || task.module}
              </Badge>
            </div>

            <Separator />

            {/* Detail fields */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailField icon={<User className="h-4 w-4" />} label={t.assignee}
                value={assigneeName || task.assigned_to || '-'} />
              <DetailField icon={<Calendar className="h-4 w-4" />} label={t.dueDate}
                value={task.due_date ? new Date(task.due_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US') : '-'}
                danger={task.status === 'Overdue'} />
              <DetailField icon={<FileText className="h-4 w-4" />} label={t.source}
                value={task.source_document ? `${task.source_doctype}: ${task.source_document}` : '-'} />
              <DetailField icon={<ArrowRight className="h-4 w-4" />} label={t.target}
                value={task.target_document ? `${task.target_doctype}: ${task.target_document}` : '-'} />
              <DetailField icon={<Clock className="h-4 w-4" />} label={t.created}
                value={new Date(task.creation).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} />
              {task.completed_date && (
                <DetailField icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label={t.completed}
                  value={new Date(task.completed_date).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} />
              )}
            </div>

            {/* Description */}
            {task.description && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-1">{t.description}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
              </>
            )}

            {/* Actions */}
            {isOpen && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-2">{t.actions}</h4>
                  <div className="flex flex-wrap gap-2">
                    {task.status === 'New' && (
                      <Button size="sm" variant="outline" onClick={() => handleAction('In Progress')} disabled={acting}>
                        <Play className="h-3.5 w-3.5 me-1" /> {t.markInProgress}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => handleAction('Completed')} disabled={acting}
                      className="bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5 me-1" /> {t.markComplete}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction('Cancelled')} disabled={acting}>
                      <XCircle className="h-3.5 w-3.5 me-1" /> {t.markCancelled}
                    </Button>
                    {canClaim && (
                      <Button size="sm" variant="secondary" onClick={() => handleAction('claim')} disabled={acting}>
                        <Hand className="h-3.5 w-3.5 me-1" /> {t.claimTask}
                      </Button>
                    )}
                  </div>

                  {/* Note input */}
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder={t.notePlaceholder}
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Activity log */}
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">{t.activityLog}</h4>
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.noLogs}</p>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.name} className="flex gap-2 text-xs border-l-2 border-muted pl-3 py-1">
                      <div className="flex-1">
                        <span className="font-medium">{log.action}</span>
                        {log.from_status && log.to_status && (
                          <span className="text-muted-foreground"> {log.from_status} → {log.to_status}</span>
                        )}
                        {log.notes && (
                          <p className="text-muted-foreground mt-0.5">{log.notes}</p>
                        )}
                      </div>
                      <div className="text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function DetailField({ icon, label, value, danger }: {
  icon: React.ReactNode; label: string; value: string; danger?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn('text-sm font-medium truncate', danger && 'text-red-600')}>
        {value}
      </p>
    </div>
  )
}
