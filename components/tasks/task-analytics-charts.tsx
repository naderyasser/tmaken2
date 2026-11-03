'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { taskApi, type TaskStats } from '@/lib/task-api'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const L = {
  en: {
    byModule: 'Tasks by Module',
    byStatus: 'Tasks by Status',
    byPriority: 'Tasks by Priority',
    noData: 'No data available',
    inventory: 'Inventory', purchases: 'Purchases', sales: 'Sales',
    hr: 'HR', accounting: 'Accounting', admin: 'Admin',
    new: 'New', inProgress: 'In Progress', completed: 'Completed',
    cancelled: 'Cancelled', overdue: 'Overdue',
    low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
  },
  ar: {
    byModule: 'المهام حسب القسم',
    byStatus: 'المهام حسب الحالة',
    byPriority: 'المهام حسب الأولوية',
    noData: 'لا توجد بيانات',
    inventory: 'المخزون', purchases: 'المشتريات', sales: 'المبيعات',
    hr: 'الموارد البشرية', accounting: 'المحاسبة', admin: 'الإدارة',
    new: 'جديد', inProgress: 'قيد التنفيذ', completed: 'مكتمل',
    cancelled: 'ملغي', overdue: 'متأخر',
    low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل',
  }
}

const MODULE_COLORS: Record<string, string> = {
  Inventory: '#f97316', Purchases: '#10b981', Sales: '#8b5cf6',
  HR: '#3b82f6', Accounting: '#6366f1', Admin: '#6b7280',
}
const STATUS_COLORS: Record<string, string> = {
  New: '#3b82f6', 'In Progress': '#f59e0b', Completed: '#22c55e',
  Cancelled: '#6b7280', Overdue: '#ef4444',
}
const PRIORITY_COLORS: Record<string, string> = {
  Low: '#94a3b8', Medium: '#f59e0b', High: '#f97316', Urgent: '#ef4444',
}

interface Props {
  lang: 'en' | 'ar'
  isRTL: boolean
  stats: TaskStats | null
}

export function TaskAnalyticsCharts({ lang, isRTL, stats }: Props) {
  const t = L[lang]

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-[260px] rounded-xl" />)}
      </div>
    )
  }

  const moduleData = Object.entries(stats.by_module || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: t[(key.toLowerCase()) as keyof typeof t] || key,
      value,
      fill: MODULE_COLORS[key] || '#6b7280',
    }))

  const statusData = Object.entries(stats.by_status || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: t[(key === 'In Progress' ? 'inProgress' : key.toLowerCase()) as keyof typeof t] || key,
      value,
      fill: STATUS_COLORS[key] || '#6b7280',
    }))

  const priorityData = Object.entries(stats.by_priority || {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: t[key.toLowerCase() as keyof typeof t] || key,
      value,
      fill: PRIORITY_COLORS[key] || '#6b7280',
    }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* By Module — Horizontal Bar */}
      <ChartCard title={t.byModule}>
        {moduleData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={moduleData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={11} />
              <YAxis type="category" dataKey="name" width={70} fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {moduleData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState label={t.noData} />}
      </ChartCard>

      {/* By Status — Donut */}
      <ChartCard title={t.byStatus}>
        {statusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                paddingAngle={2} strokeWidth={0}
              >
                {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <EmptyState label={t.noData} />}
      </ChartCard>

      {/* By Priority — Vertical Bar */}
      <ChartCard title={t.byPriority}>
        {priorityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData} margin={{ left: 0, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {priorityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState label={t.noData} />}
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
