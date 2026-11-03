'use client'

import { useState } from 'react'
import type { WorkflowTask } from '@/lib/task-api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  ArrowUpDown, User, Calendar, AlertTriangle,
  Boxes, Truck, Users, Briefcase, Calculator, Shield, CheckCircle2
} from 'lucide-react'

const L = {
  en: {
    title: 'Title', status: 'Status', priority: 'Priority', module: 'Module',
    assignee: 'Assignee', dueDate: 'Due Date', source: 'Source', age: 'Age',
    new: 'New', inProgress: 'In Progress', completed: 'Completed',
    cancelled: 'Cancelled', overdue: 'Overdue',
    low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
    inventory: 'Inventory', purchases: 'Purchases', sales: 'Sales',
    hr: 'HR', accounting: 'Accounting', admin: 'Admin',
    noTasks: 'No tasks found', days: 'd', hours: 'h',
    unassigned: 'Unassigned',
  },
  ar: {
    title: 'العنوان', status: 'الحالة', priority: 'الأولوية', module: 'الموديول',
    assignee: 'المسؤول', dueDate: 'تاريخ الاستحقاق', source: 'المصدر', age: 'العمر',
    new: 'جديد', inProgress: 'قيد التنفيذ', completed: 'مكتمل',
    cancelled: 'ملغي', overdue: 'متأخر',
    low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل',
    inventory: 'المخزون', purchases: 'المشتريات', sales: 'المبيعات',
    hr: 'الموارد البشرية', accounting: 'المحاسبة', admin: 'الإدارة',
    noTasks: 'لا توجد مهام', days: 'ي', hours: 'س',
    unassigned: 'غير معين',
  }
}

const priorityBadge: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Urgent: 'bg-red-100 text-red-700 animate-pulse',
}

const statusBadge: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-500',
  Overdue: 'bg-red-100 text-red-700',
}

const moduleIcons: Record<string, React.ReactNode> = {
  Inventory:  <Boxes className="h-3.5 w-3.5" />,
  Purchases:  <Truck className="h-3.5 w-3.5" />,
  Sales:      <Users className="h-3.5 w-3.5" />,
  HR:         <Briefcase className="h-3.5 w-3.5" />,
  Accounting: <Calculator className="h-3.5 w-3.5" />,
  Admin:      <Shield className="h-3.5 w-3.5" />,
}

function getAge(creation: string, lang: 'en' | 'ar') {
  const t = L[lang]
  const diff = Date.now() - new Date(creation).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}${t.hours}`
  return `${Math.floor(hours / 24)}${t.days}`
}

interface TaskListProps {
  tasks: WorkflowTask[]
  lang: 'en' | 'ar'
  isRTL: boolean
  onTaskClick: (task: WorkflowTask) => void
}

export function TaskList({ tasks, lang, isRTL, onTaskClick }: TaskListProps) {
  const t = L[lang]
  const [sortField, setSortField] = useState<string>('creation')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    const aVal = (a as any)[sortField] || ''
    const bVal = (b as any)[sortField] || ''
    const cmp = String(aVal).localeCompare(String(bVal))
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mr-2 opacity-40" />
        <span>{t.noTasks}</span>
      </div>
    )
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {[
              { key: 'title', label: t.title },
              { key: 'status', label: t.status },
              { key: 'priority', label: t.priority },
              { key: 'module', label: t.module },
              { key: 'assigned_to', label: t.assignee },
              { key: 'due_date', label: t.dueDate },
              { key: 'source_document', label: t.source },
              { key: 'creation', label: t.age },
            ].map(col => (
              <TableHead
                key={col.key}
                className="cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(task => {
            const isOverdue = task.status === 'Overdue'
            const isDueSoon = task.due_date && new Date(task.due_date) <= new Date() && task.status !== 'Completed'
            const statusKey = task.status === 'In Progress' ? 'inProgress' : task.status.toLowerCase()
            const moduleKey = task.module.toLowerCase()

            return (
              <TableRow
                key={task.name}
                className={cn(
                  'cursor-pointer hover:bg-muted/30 transition-colors',
                  isOverdue && 'bg-red-50/50'
                )}
                onClick={() => onTaskClick(task)}
              >
                <TableCell className="font-medium max-w-[250px]">
                  <span className="line-clamp-1">{task.title}</span>
                </TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px]', statusBadge[task.status])} variant="secondary">
                    {t[statusKey as keyof typeof t] || task.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px]', priorityBadge[task.priority])} variant="secondary">
                    {t[task.priority.toLowerCase() as keyof typeof t] || task.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs">
                    {moduleIcons[task.module]}
                    <span>{t[moduleKey as keyof typeof t] || task.module}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[100px]">
                      {(task as any).assignee_name || task.assigned_to || t.unassigned}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {task.due_date ? (
                    <div className={cn('flex items-center gap-1 text-xs', isDueSoon && 'text-red-600 font-medium')}>
                      {isDueSoon ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                      {new Date(task.due_date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px] block">
                    {task.source_document || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {getAge(task.creation, lang)}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
