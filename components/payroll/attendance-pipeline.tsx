'use client'

/**
 * F7/F8 — Attendance → Payroll pipeline. 8 KPI tiles + readiness banner + a
 * review queue (Planned-Action violations) + per-employee attendance detail
 * (calendar + Log/Fingerprints/Requests/Payroll-impact) + multi-dimensional
 * filters (branch/department/…). Auto-posting of deductions is DISABLED —
 * approve_pipeline_item returns {disabled} and we surface that, never a success.
 * Token-only, logical RTL, all figures display-only.
 */
import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlarmClock, LogOut, UserX, FileWarning, CalendarX, Hourglass, Loader2,
  Wrench, CheckCircle2, ShieldAlert, Info, CalendarDays,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, KpiTile, FilterBar, DataTable, DetailDrawer, SegmentedControl } from '@/components/shared'
import type { DataTableColumn, DataTableBulkAction } from '@/components/shared'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { translateDepartment } from '@/lib/enums'
import { useToast } from '@/hooks/use-toast'
import { formatDateShort, formatSAR } from '@/lib/format'

const call = async (method: string, args?: any) => (await frappeClient.call(method, args) as any)?.message

const TILES: { key: string; icon: any; tone: any }[] = [
  { key: 'late_arrival', icon: AlarmClock, tone: 'warning' },
  { key: 'early_departure', icon: LogOut, tone: 'warning' },
  { key: 'absence', icon: UserX, tone: 'danger' },
  { key: 'incomplete_records', icon: FileWarning, tone: 'warning' },
  { key: 'unscheduled', icon: CalendarX, tone: 'default' },
  { key: 'pending_approval', icon: Hourglass, tone: 'info' },
  { key: 'actions_in_progress', icon: Wrench, tone: 'info' },
  { key: 'approved_ready', icon: CheckCircle2, tone: 'success' },
]

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function AttendancePipeline() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const { toast } = useToast()

  const [month, setMonth] = useState(thisMonth)
  const [branch, setBranch] = useState('')
  const [department, setDepartment] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [pipeline, setPipeline] = useState<any>(null)
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [detailTab, setDetailTab] = useState('calendar')

  useEffect(() => {
    frappeClient.getList('Branch', { fields: ['name'], limit_page_length: 200 })
      .then((r: any) => setBranches((r?.data || r || []).map((b: any) => b.name))).catch(() => {})
    frappeClient.getList('Department', { fields: ['name'], limit_page_length: 200 })
      .then((r: any) => setDepartments((r?.data || r || []).map((d: any) => d.name))).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const args: any = { month }
      if (branch) args.branch = branch
      const queueArgs: any = { ...args }
      if (department) queueArgs.department = department
      const [p, q] = await Promise.all([
        call('base_meena.api.pipeline_api.get_payroll_pipeline', args).catch(() => null),
        call('base_meena.api.pipeline_api.get_pipeline_review_queue', queueArgs).catch(() => []),
      ])
      setPipeline(p || {})
      setQueue(Array.isArray(q) ? q : (q?.rows || []))
    } catch {
      toast({ title: tx('Failed to load pipeline', 'تعذّر تحميل مسار الرواتب'), variant: 'destructive' })
    } finally { setLoading(false) }
  }, [month, branch, department]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const openDetail = async (employee: string, employee_name: string) => {
    setDetail({ employee, employee_name, data: null }); setDetailTab('calendar')
    try {
      const d = await call('base_meena.api.pipeline_api.get_employee_attendance_detail', { employee, month })
      setDetail({ employee, employee_name, data: d || {} })
    } catch { setDetail({ employee, employee_name, data: {} }) }
  }

  const readiness = pipeline?.readiness || {}
  // The endpoint returns `tiles: [{key, count, label, label_ar}]`, not a map keyed
  // by tile name — index it here or every tile renders 0 with its raw key as label.
  const tileByKey = useMemo(() => {
    const map: Record<string, any> = {}
    for (const t of (pipeline?.tiles || [])) if (t?.key) map[t.key] = t
    return map
  }, [pipeline])

  const cols: DataTableColumn<any>[] = [
    { id: 'employee_name', header: tx('Employee', 'الموظف'), cell: (r) => r.employee_name || r.employee || '—' },
    { id: 'violation_date', header: tx('Date', 'التاريخ'), cell: (r) => (r.violation_date ? formatDateShort(r.violation_date) : '—') },
    { id: 'violation_type', header: tx('Type', 'النوع'), cell: (r) => r.violation_category || r.violation_type || '—' },
    { id: 'deduction_amount', header: tx('Deduction', 'الخصم'), cell: (r) => (r.deduction_amount != null ? formatSAR(r.deduction_amount, 2) : '—') },
  ]

  const doApprove = async (rows: any[]) => {
    let disabledReason = ''
    for (const r of rows) {
      const res = await call('base_meena.api.pipeline_api.approve_pipeline_item', { name: r.name }).catch(() => null)
      if (res?.disabled) disabledReason = res.reason || ''
    }
    toast({
      title: tx('Auto-posting disabled', 'الترحيل التلقائي معطّل'),
      description: disabledReason || tx('Deduction posting is disabled pending HR sign-off.', 'ترحيل الخصومات معطّل حتى اعتماد الموارد البشرية.'),
    })
  }
  const bulk: DataTableBulkAction<any>[] = [
    { id: 'approve', label: tx('Approve (review)', 'اعتماد (مراجعة)'), onSelect: doApprove },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={tx('Attendance → Payroll', 'الحضور ← الرواتب')}
        description={tx('Monthly exceptions ready for payroll review.', 'استثناءات الشهر الجاهزة لمراجعة الرواتب.')}
      />

      {/* disabled-calc banner */}
      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
        <ShieldAlert className="h-4 w-4 shrink-0 text-warning mt-0.5" />
        <span>{tx('Deduction calculations & auto-posting are disabled pending HR sign-off — figures are read-only.',
          'حسابات الخصومات والترحيل التلقائي معطّلة حتى اعتماد الموارد البشرية — الأرقام للعرض فقط.')}</span>
      </div>

      <FilterBar>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <Select value={branch || '__all'} onValueChange={(v) => setBranch(v === '__all' ? '' : v)}>
          <SelectTrigger aria-label={tx('Branch', 'الفرع')} className="w-44"><SelectValue placeholder={tx('Branch', 'الفرع')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{tx('All branches', 'كل الفروع')}</SelectItem>
            {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={department || '__all'} onValueChange={(v) => setDepartment(v === '__all' ? '' : v)}>
          <SelectTrigger aria-label={tx('Department', 'القسم')} className="w-48"><SelectValue placeholder={tx('Department', 'القسم')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{tx('All departments', 'كل الأقسام')}</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{translateDepartment(d, isRTL ? 'ar' : 'en')}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {/* 8 KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TILES.map(({ key, icon, tone }) => {
          const t = tileByKey[key] || {}
          return (
            <KpiTile
              key={key}
              label={isRTL ? (t.label_ar || t.label || key) : (t.label || key)}
              value={loading ? '—' : (t.count ?? 0)}
              icon={icon}
              tone={tone}
              loading={loading}
            />
          )
        })}
      </div>

      {/* readiness banner */}
      <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${readiness.ready ? 'border-success/40 bg-success/10' : 'border-border bg-muted'}`}>
        {readiness.ready ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Info className="h-4 w-4 text-muted-foreground" />}
        <span className="text-foreground">
          {readiness.ready
            ? tx('Ready for payroll — no open planned actions.', 'جاهز للرواتب — لا إجراءات معلّقة.')
            : tx('Not ready: resolve planned actions & pending punch corrections.', 'غير جاهز: عالج الإجراءات المعلّقة وتصحيحات البصمة.')}
        </span>
      </div>

      {/* review queue */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            rows={queue}
            columns={cols}
            getRowId={(r) => r.name}
            isRTL={isRTL}
            loading={loading}
            searchable
            searchAccessor={(r) => r.employee_name || r.employee || ''}
            searchPlaceholder={tx('Search employee…', 'ابحث عن موظف…')}
            bulkActions={bulk}
            onRowClick={(r) => openDetail(r.employee, r.employee_name)}
            emptyIcon={CheckCircle2}
            emptyMessage={tx('No items to review — no planned actions this month.', 'لا عناصر للمراجعة — لا إجراءات معلّقة هذا الشهر.')}
          />
        </CardContent>
      </Card>

      {/* per-employee detail drawer */}
      <DetailDrawer
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.employee_name || tx('Attendance detail', 'تفاصيل الحضور')}
        description={month}
        size="lg"
      >
        {!detail?.data ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <SegmentedControl
              value={detailTab}
              onChange={setDetailTab}
              options={[
                { id: 'calendar', label: tx('Calendar', 'التقويم') },
                { id: 'logs', label: tx('Log', 'السجل') },
                { id: 'requests', label: tx('Requests', 'الطلبات') },
                { id: 'payroll', label: tx('Payroll impact', 'أثر الرواتب') },
              ]}
            />
            {detailTab === 'calendar' && (
              <div className="grid grid-cols-7 gap-1">
                {(detail.data.calendar || []).map((d: any, i: number) => (
                  <div key={i} className="aspect-square rounded-md border border-border bg-card p-1 text-center text-[10px]">
                    <div className="font-medium text-foreground">{d.date ? String(d.date).slice(-2) : ''}</div>
                    <div className="text-muted-foreground truncate">{d.status || ''}</div>
                  </div>
                ))}
                {(!detail.data.calendar || detail.data.calendar.length === 0) && <p className="col-span-7 text-sm text-muted-foreground">{tx('No data', 'لا بيانات')}</p>}
              </div>
            )}
            {detailTab === 'logs' && <SimpleList rows={detail.data.logs} tx={tx} />}
            {detailTab === 'requests' && <SimpleList rows={detail.data.requests} tx={tx} />}
            {detailTab === 'payroll' && <SimpleList rows={detail.data.payroll_impact} tx={tx} />}
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}

function SimpleList({ rows, tx }: { rows: any[]; tx: (e: string, a: string) => string }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-muted-foreground py-4">{tx('No records', 'لا سجلات')}</p>
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground">
          {Object.entries(r).map(([k, v]) => (
            <span key={k} className="me-3 text-muted-foreground">{k}: <span className="text-foreground">{v == null ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v))}</span></span>
          ))}
        </div>
      ))}
    </div>
  )
}
