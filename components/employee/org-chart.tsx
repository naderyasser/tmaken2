'use client'

/**
 * F4 — Organization chart from Employee.reports_to (base_meena api.org_chart).
 *
 * Thin data wrapper: fetches the hierarchy and renders the reusable, interactive
 * <OrgChartTree> (pan / zoom / expand-collapse). Clicking a card opens that
 * employee's 360° profile. The data contract is unchanged from the old list view.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Info } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { PageHeader, EmptyState } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { OrgChartTree, type OrgNode } from './org-chart-tree'

// Role grouping: order siblings by designation seniority, then name — so each manager's
// reports read as "Managers → Engineers → Employees → Sellers …" like Jisr, and the flat
// forest (when no reports_to is set) at least clusters by role instead of arbitrary order.
const ROLE_RANK: Array<[RegExp, number]> = [
  [/chief|\bceo\b|رئيس تنفيذي/i, 0],
  [/managing director|مدير عام/i, 1],
  [/manager|director|مدير|رئيس/i, 2],
  [/supervisor|team lead|\bhead\b|مشرف|مسؤول/i, 3],
  [/engineer|مهندس|فني/i, 4],
  [/officer|specialist|accountant|إداري|أخصائي|محاسب|منسق/i, 5],
  [/employee|موظف|كاتب/i, 6],
  [/sales|seller|بائع|مندوب|مبيعات/i, 7],
]
function roleRank(designation?: string): number {
  const d = designation || ''
  for (const [re, r] of ROLE_RANK) if (re.test(d)) return r
  return d ? 8 : 9 // titled-but-unmapped before untitled
}
function sortForest(nodes: OrgNode[]): OrgNode[] {
  const sorted = [...nodes].sort(
    (a, b) =>
      roleRank(a.designation) - roleRank(b.designation) ||
      (a.employee_name || '').localeCompare(b.employee_name || '', 'ar'),
  )
  for (const n of sorted) if (n.children?.length) n.children = sortForest(n.children)
  return sorted
}

export function OrgChart() {
  const { isRTL } = useI18n()
  const router = useRouter()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const [roots, setRoots] = useState<OrgNode[]>([])
  const [loading, setLoading] = useState(true)
  // "Flat" = several people but no reporting links anywhere → the chart can't nest.
  const flat = roots.length > 1 && !roots.some((r) => (r.children?.length || 0) > 0)

  useEffect(() => {
    frappeClient
      .call('base_meena.api.org_chart.get_org_chart', {})
      .then((r: any) => {
        const m = r?.message
        const list = Array.isArray(m) ? m : m?.children ? m.children : m && m.employee ? [m] : []
        setRoots(sortForest(list))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 border-b border-border bg-card/50 px-6 py-4">
        <PageHeader
          title={tx('Organization Chart', 'الهيكل التنظيمي')}
          description={tx('Reporting structure from “reports to” — drag to pan, scroll to zoom', 'هيكل التبعية الإداري من حقل «يتبع لـ» — اسحب للتنقّل، مرّر للتكبير')}
        />
      </div>

      {!loading && flat && (
        <div className="flex shrink-0 items-start gap-2 border-b border-warning/40 bg-warning/10 px-6 py-2.5 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            {tx(
              `No reporting lines are set yet, so all ${roots.length} employees show side by side (grouped by role). Set each person's “Reports To” in their employee page to build the top-down tree.`,
              `لا توجد علاقات تبعية إدارية بعد، لذا تظهر جميع الموظفين (${roots.length}) جنبًا إلى جنب (مُجمّعين حسب الدور). عيّن حقل «يتبع لـ» لكل موظف من صفحته لبناء الهيكل الهرمي.`,
            )}
          </span>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Skeleton className="h-[68px] w-[236px] rounded-2xl" />
            <div className="flex gap-6">
              <Skeleton className="h-[68px] w-[236px] rounded-2xl" />
              <Skeleton className="h-[68px] w-[236px] rounded-2xl" />
              <Skeleton className="h-[68px] w-[236px] rounded-2xl" />
            </div>
          </div>
        ) : roots.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={Users}
              title={tx('No hierarchy yet', 'لا يوجد هيكل بعد')}
              description={tx('Set employees’ “reports to” to build the chart', 'عيّن حقل «يتبع لـ» للموظفين لبناء الهيكل')}
            />
          </div>
        ) : (
          <OrgChartTree
            roots={roots}
            onSelect={(node) => router.push(`/employee/${encodeURIComponent(node.employee)}`)}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  )
}
