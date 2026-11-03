'use client'

/**
 * F3 — Violations Register. Segmented views (All / Open / Closed / Exempted),
 * a token-themed DataTable, a detail drawer with state actions (Exempt /
 * Invalidate), and a "Report a violation" dialog. Reads base_meena
 * penalty_management.violations_api. Bilingual via an inline tx() helper.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, Loader2, ShieldAlert, Ban, CircleSlash } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SegmentedControl, DataTable, DetailDrawer, type DataTableColumn } from '@/components/shared'
import { getStatusClass } from '@/lib/status-config'
import { formatDateShort, formatSAR } from '@/lib/format'

interface Violation {
  name: string
  employee: string
  employee_name: string
  violation_date: string | null
  penalty_applied: string | null
  deduction_amount: number | null
  appeal_status: string | null
  violation_status: string | null
  violation_category: string | null
  source: string | null
  reported_by: string | null
  reason: string | null
  effective_status: string | null
}

function Chip({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(status)}`}>{status}</span>
}

export function ViolationsRegister() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const { toast } = useToast()

  const [view, setView] = useState('open')
  const [rows, setRows] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Violation | null>(null)
  const [acting, setActing] = useState(false)
  const [stateReason, setStateReason] = useState('')

  // report dialog
  const [reportOpen, setReportOpen] = useState(false)
  const [categories, setCategories] = useState<{ name: string; category_name?: string; category_name_ar?: string }[]>([])
  const [employees, setEmployees] = useState<{ name: string; employee_name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ employee: '', category: '', violation_date: new Date().toISOString().slice(0, 10), description: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await frappeClient.call('base_meena.penalty_management.violations_api.get_violations', { view })
      setRows((res as any)?.message || [])
    } catch {
      toast({ title: tx('Error', 'خطأ'), description: tx('Failed to load violations', 'تعذّر تحميل المخالفات'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    frappeClient.getList('Violation Category', { fields: ['name', 'category_name', 'category_name_ar'], limit_page_length: 0 } as any)
      .then((l: any) => setCategories(l || [])).catch(() => {})
    frappeClient.getEmployees({ fields: ['name', 'employee_name'], filters: [['Employee', 'status', '=', 'Active']] as any, order_by: 'employee_name asc', limit_page_length: 0 })
      .then((l: any) => setEmployees(l || [])).catch(() => {})
  }, [])

  const VIEWS = [
    { id: 'all', label: tx('All', 'الكل') },
    { id: 'open', label: tx('Open', 'مفتوحة') },
    { id: 'closed', label: tx('Closed', 'مغلقة') },
    { id: 'exempted', label: tx('Exempted', 'مُعفاة') },
  ]

  const columns: DataTableColumn<Violation>[] = useMemo(() => [
    { id: 'employee', header: tx('Employee', 'الموظف'), cell: (r) => <span className="font-medium">{r.employee_name || r.employee}</span>, sortable: true, sortAccessor: (r) => r.employee_name || '', exportAccessor: (r) => r.employee_name },
    { id: 'category', header: tx('Category', 'التصنيف'), cell: (r) => r.violation_category || '—', exportAccessor: (r) => r.violation_category },
    { id: 'date', header: tx('Date', 'التاريخ'), cell: (r) => (r.violation_date ? formatDateShort(r.violation_date) : '—'), sortable: true, sortAccessor: (r) => r.violation_date || '', exportAccessor: (r) => r.violation_date },
    { id: 'state', header: tx('State', 'الحالة'), cell: (r) => <Chip status={r.effective_status} />, exportAccessor: (r) => r.effective_status },
    { id: 'source', header: tx('Source', 'المصدر'), cell: (r) => (r.source === 'Manual' ? tx('Manual', 'يدوي') : tx('Auto', 'آلي')), exportAccessor: (r) => r.source },
    { id: 'penalty', header: tx('Penalty', 'الجزاء'), cell: (r) => r.penalty_applied || '—', exportAccessor: (r) => r.penalty_applied },
    { id: 'deduction', header: tx('Deduction', 'الخصم'), align: 'end', cell: (r) => (r.deduction_amount ? formatSAR(r.deduction_amount) : '—'), exportAccessor: (r) => r.deduction_amount ?? '' },
  ], [isRTL])

  const setState = async (state: string) => {
    if (!detail) return
    setActing(true)
    try {
      await frappeClient.call('base_meena.penalty_management.violations_api.set_violation_state', { name: detail.name, state, reason: stateReason })
      toast({ title: tx('Updated', 'تم التحديث'), description: `${detail.employee_name} → ${state}` })
      setDetail(null); setStateReason('')
      load()
    } catch (e: any) {
      toast({ title: tx('Error', 'خطأ'), description: String(e?.message || e).slice(0, 160), variant: 'destructive' })
    } finally { setActing(false) }
  }

  const submitReport = async () => {
    if (!form.employee || !form.category) {
      toast({ title: tx('Missing info', 'بيانات ناقصة'), description: tx('Employee and category are required', 'الموظف والتصنيف مطلوبان'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await frappeClient.call('base_meena.penalty_management.violations_api.report_violation', {
        employee: form.employee, category: form.category, violation_date: form.violation_date, description: form.description,
      })
      toast({ title: tx('Reported', 'تم الإبلاغ'), description: tx('Violation recorded as Planned Action', 'سُجّلت المخالفة كإجراء مُخطّط') })
      setReportOpen(false); setForm({ employee: '', category: '', violation_date: new Date().toISOString().slice(0, 10), description: '' })
      setView('open'); load()
    } catch (e: any) {
      toast({ title: tx('Error', 'خطأ'), description: String(e?.message || e).slice(0, 160), variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        <Button aria-label="إضافة" title="إضافة" onClick={() => setReportOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {tx('Report violation', 'إبلاغ عن مخالفة')}
        </Button>
      </div>

      <DataTable<Violation>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.name}
        isRTL={isRTL}
        loading={loading}
        searchable
        searchAccessor={(r) => `${r.employee_name} ${r.violation_category} ${r.effective_status}`}
        exportFilename="violations"
        exportTitle={tx('Violations', 'المخالفات')}
        onRowClick={(r) => { setDetail(r); setStateReason('') }}
        emptyIcon={ShieldAlert}
        emptyMessage={tx('No violations recorded yet', 'لا توجد مخالفات مسجّلة بعد')}
        emptyDescription={tx('When a violation is reported it will appear here.', 'عند الإبلاغ عن مخالفة ستظهر هنا.')}
        emptyActionLabel={tx('Report violation', 'إبلاغ عن مخالفة')}
        emptyAction={() => setReportOpen(true)}
      />

      {/* Detail drawer */}
      <DetailDrawer
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        title={detail?.employee_name || ''}
        description={detail?.violation_category || undefined}
        headerExtra={detail ? <div><Chip status={detail.effective_status} /></div> : undefined}
        footer={detail && detail.effective_status !== 'Exempted' && detail.effective_status !== 'Invalidated' ? (
          <>
            <Button aria-label="إعفاء" title="إعفاء" variant="outline" size="sm" disabled={acting} onClick={() => setState('Exempted')}>
              <CircleSlash className="me-1.5 h-4 w-4" />{tx('Exempt', 'إعفاء')}
            </Button>
            <Button aria-label="إلغاء" title="إلغاء" variant="outline" size="sm" disabled={acting} onClick={() => setState('Invalidated')}>
              <Ban className="me-1.5 h-4 w-4" />{tx('Invalidate', 'إلغاء')}
            </Button>
          </>
        ) : undefined}
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <Row label={tx('Date', 'التاريخ')} value={detail.violation_date ? formatDateShort(detail.violation_date) : '—'} />
            <Row label={tx('State', 'الحالة')} value={<Chip status={detail.effective_status} />} />
            <Row label={tx('Source', 'المصدر')} value={detail.source === 'Manual' ? tx('Manual', 'يدوي') : tx('Auto', 'آلي')} />
            <Row label={tx('Reported by', 'أبلغ بواسطة')} value={detail.reported_by || '—'} />
            <Row label={tx('Penalty', 'الجزاء')} value={detail.penalty_applied || '—'} />
            <Row label={tx('Deduction', 'الخصم')} value={detail.deduction_amount ? formatSAR(detail.deduction_amount) : '—'} />
            <Row label={tx('Appeal', 'التظلّم')} value={detail.appeal_status || '—'} />
            {detail.reason && <div><p className="mb-1 text-muted-foreground">{tx('Reason', 'السبب')}</p><p className="rounded-lg bg-muted p-3">{detail.reason}</p></div>}
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs text-muted-foreground">{tx('Reason for state change', 'سبب تغيير الحالة')}</Label>
              <Textarea value={stateReason} onChange={(e) => setStateReason(e.target.value)} rows={2} placeholder={tx('Optional note…', 'ملاحظة اختيارية…')} />
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />{tx('Report a violation', 'إبلاغ عن مخالفة')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{tx('Employee', 'الموظف')}</Label>
              <Select value={form.employee} onValueChange={(v) => setForm({ ...form, employee: v })}>
                <SelectTrigger aria-label={tx('Select employee', 'اختر الموظف')}><SelectValue placeholder={tx('Select employee', 'اختر الموظف')} /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.name} value={e.name}>{e.employee_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tx('Category', 'التصنيف')}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger aria-label={tx('Select category', 'اختر التصنيف')}><SelectValue placeholder={tx('Select category', 'اختر التصنيف')} /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.name} value={c.name}>{(isRTL && c.category_name_ar) || c.category_name || c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tx('Date', 'التاريخ')}</Label>
              <Input type="date" value={form.violation_date} onChange={(e) => setForm({ ...form, violation_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{tx('Description', 'الوصف')}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>{tx('Cancel', 'إلغاء')}</Button>
            <Button onClick={submitReport} disabled={saving}>{saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}{tx('Submit', 'إرسال')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium text-foreground">{value}</span>
    </div>
  )
}
