'use client'

/**
 * Workforce-at-a-glance panel for the Analytics Hub — gives the page a real chart
 * (headcount by department + by branch) instead of opening as a plain link list.
 * Reads Active employees directly (no backend change) and groups client-side.
 * Lives under `.theme-hr` (light) so the teal palette is fixed-hex safe.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Building2, Users, Layers, Briefcase } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { Skeleton } from '@/components/ui/skeleton'

const TEAL = '#0E6E62'
const DONUT = ['#0E6E62', '#2E8B7E', '#5AA99C', '#86C4B9', '#B4E0D8', '#8FA6A0', '#C3D2CD']

interface Emp { name: string; department?: string; branch?: string; designation?: string }

function groupCount(rows: Emp[], key: keyof Emp, fallback: string) {
  const m = new Map<string, number>()
  for (const r of rows) {
    const v = (r[key] || '').toString().trim() || fallback
    m.set(v, (m.get(v) || 0) + 1)
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

const short = (s: string, n = 20) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function WorkforceOverview() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const unset = tx('Unassigned', 'غير محدد')
  const [rows, setRows] = useState<Emp[] | null>(null)

  useEffect(() => {
    frappeClient
      .get('Employee', undefined, {
        fields: ['name', 'department' as any, 'branch' as any, 'designation' as any],
        filters: [['status', '=', 'Active']] as any,
        limit_page_length: 0 as any,
      })
      .then((r: any) => setRows((r?.data || []) as Emp[]))
      .catch(() => setRows([]))
  }, [])

  const byDept = useMemo(() => (rows ? groupCount(rows, 'department', unset).slice(0, 8) : []), [rows, unset])
  const byBranch = useMemo(() => (rows ? groupCount(rows, 'branch', unset).slice(0, 7) : []), [rows, unset])
  const stats = useMemo(() => {
    if (!rows) return null
    return {
      total: rows.length,
      departments: new Set(rows.map((r) => (r.department || '').trim()).filter(Boolean)).size,
      branches: new Set(rows.map((r) => (r.branch || '').trim()).filter(Boolean)).size,
      designations: new Set(rows.map((r) => (r.designation || '').trim()).filter(Boolean)).size,
    }
  }, [rows])

  if (!rows) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="mb-4 h-5 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
        <Skeleton className="mt-4 h-56 w-full rounded-lg" />
      </div>
    )
  }
  if (rows.length === 0) return null

  const tiles = [
    { icon: Users, label: tx('Employees', 'الموظفون'), value: stats!.total },
    { icon: Layers, label: tx('Departments', 'الأقسام'), value: stats!.departments },
    { icon: Building2, label: tx('Branches', 'الفروع'), value: stats!.branches },
    { icon: Briefcase, label: tx('Job titles', 'المسميات'), value: stats!.designations },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{tx('Workforce at a glance', 'نظرة عامة على القوى العاملة')}</h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <div key={t.label} className="flex items-center gap-3 rounded-lg border border-border bg-accent/40 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-xl font-bold leading-none tabular-nums text-foreground">{t.value}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{t.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Headcount by department — horizontal bars read long Arabic names cleanly */}
        <div className="lg:col-span-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{tx('Headcount by department', 'التوزيع حسب القسم')}</div>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" width={150} tickFormatter={(v: string) => short(v)}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip cursor={{ fill: 'hsl(var(--accent))' }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }} />
                <Bar dataKey="value" fill={TEAL} radius={[0, 4, 4, 0]} maxBarSize={26} name={tx('Employees', 'موظفون')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Headcount by branch — donut */}
        <div className="lg:col-span-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{tx('Headcount by branch', 'التوزيع حسب الفرع')}</div>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byBranch} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="hsl(var(--card))">
                  {byBranch.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Legend formatter={(v: string) => <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{short(v, 16)}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
