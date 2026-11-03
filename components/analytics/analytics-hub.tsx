'use client'

/**
 * F9 — Analytics Hub. Ready-made report templates grouped by category; click a
 * card → ReportViewer (run + export xlsx/pdf/print). Extensible: templates come
 * from the backend report_hub registry. Read-only.
 */
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Users, ShieldCheck, Wallet, Cog, HeartHandshake, UserCog, CalendarClock, TrendingUp, Boxes, Inbox, ListChecks, ChevronLeft, ChevronRight, Loader2, FileBarChart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, EmptyState } from '@/components/shared'
import { ReportViewer } from './report-viewer'
import { WorkforceOverview } from './workforce-overview'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'

const call = async (method: string, args?: any) => (await frappeClient.call(method, args) as any)?.message

const CATS: { id: string; en: string; ar: string; icon: any }[] = [
  { id: 'people', en: 'Employees', ar: 'الموظفون', icon: Users },
  { id: 'compliance', en: 'Compliance', ar: 'الامتثال', icon: ShieldCheck },
  { id: 'finance', en: 'Finance', ar: 'المالية', icon: Wallet },
  { id: 'operations', en: 'Operations & Requests', ar: 'العمليات والطلبات', icon: Cog },
]

// Distinct icon per report template so the card grid is scannable at a glance
// (previously every card shared one bar-chart icon). Unmapped templates fall
// back to their category icon (from CATS), then a generic report icon.
const REPORT_ICONS: Record<string, any> = {
  employee_list: Users,
  family_data: HeartHandshake,
  employee_info_changes: UserCog,
  document_expiry: CalendarClock,
  advances: Wallet,
  salary_changes: TrendingUp,
  custody_assignments: Boxes,
  requests: Inbox,
  tasks: ListChecks,
}

export function AnalyticsHub() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const [templates, setTemplates] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    call('base_meena.report_hub.api.list_report_templates')
      .then((r) => setTemplates(Array.isArray(r) ? r : (r?.templates || [])))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  if (selected) return <ReportViewer template={selected} onBack={() => setSelected(null)} />

  const Chevron = isRTL ? ChevronLeft : ChevronRight

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title={tx('Analytics Hub', 'مركز التحليلات')}
        description={tx('Ready-made reports with Excel / PDF / print export.', 'تقارير جاهزة مع تصدير إكسل / PDF / طباعة.')}
      />

      <WorkforceOverview />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : templates.length === 0 ? (
        <EmptyState icon={FileBarChart} title={tx('No report templates', 'لا توجد قوالب تقارير')} />
      ) : (
        CATS.map((cat) => {
          const list = templates.filter((t) => t.category === cat.id)
          if (list.length === 0) return null
          const CatIcon = cat.icon
          return (
            <section key={cat.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <CatIcon className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{isRTL ? cat.ar : cat.en}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((t) => {
                  const CardIcon = REPORT_ICONS[t.key] || cat.icon || FileBarChart
                  return (
                    <button
                      key={t.key}
                      onClick={() => setSelected(t)}
                      className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 text-start shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><CardIcon className="h-4 w-4" /></span>
                        <span className="truncate text-sm font-medium text-foreground">{isRTL ? (t.label_ar || t.label) : t.label}</span>
                      </div>
                      <Chevron className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
