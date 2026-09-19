'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Pencil, Trash2, MoreVertical, Loader2, Printer,
  ChevronDown, ChevronRight, ChevronLeft, Filter, AlertCircle,
} from 'lucide-react'
import { frappeClient, isAuthError } from '@/lib/api-client'
import { SessionRenew } from '@/components/login-page'
import { useAuthSafe } from '@/lib/auth-context'
import { useCompanySafe } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FieldInput, toFormValue, toPayload } from '@/components/hr/field-input'
import type { FieldDef, ListModuleConfig } from '@/lib/hr-modules'
import { ApexEmptyState, BoxIllustration } from '@/components/hr/apex-empty-state'
import { AdvancedSearchDrawer, applyDrawer, type DrawerValues } from '@/components/hr/advanced-search-drawer'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'

type Row = Record<string, any> & { name: string }

const PAGE_SIZES = [5, 10, 20, 50]

/** Arabic labels for the Frappe status values that show up in list cells. */
const VALUE_AR: Record<string, string> = {
  Approved: 'معتمد', Rejected: 'مرفوض', Open: 'مفتوح', Cancelled: 'ملغي', Draft: 'مسودة', Pending: 'قيد الانتظار',
  Active: 'نشط', Inactive: 'غير نشط', Suspended: 'موقوف', Left: 'منتهي', Completed: 'مكتمل', Working: 'قيد العمل',
  'Pending Review': 'قيد المراجعة', Low: 'منخفضة', Medium: 'متوسطة', High: 'عالية', Urgent: 'عاجلة',
  'Work From Home': 'عمل من المنزل', 'On Duty': 'مهمة عمل',
  Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء',
  Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت',
}
const ar = (v: any) => (typeof v === 'string' && VALUE_AR[v]) || v

/** Dotted paths for the three submittable-request actions (row menu, bulk
 *  «تنشيط ▾», and — once wired — the print/report surfaces), kept in one
 *  place so a backend rename only needs one edit. */
const HR_REQUEST_METHOD = {
  approve: 'base_meena.api.hr_requests.approve_request',
  reject: 'base_meena.api.hr_requests.reject_request',
  cancel: 'base_meena.api.hr_requests.cancel_request',
} as const

/** Apex doc-lifecycle pill for a `statusBadge` column: مسودة / معتمد / مرفوض / ملغي,
 *  derived from `docstatus` (+ `status` when the doctype carries one — see
 *  FieldDef.statusBadge). */
function DocBadge({ row }: { row: Row }) {
  const ds = Number(row.docstatus ?? 0)
  let label = 'مسودة'
  let cls = 'bg-slate-100 text-slate-600'
  if (ds === 2) { label = 'ملغي'; cls = 'bg-slate-200 text-slate-500' }
  else if (row.status === 'Rejected') { label = 'مرفوض'; cls = 'bg-red-100 text-red-700' }
  else if (ds === 1 || row.status === 'Approved') { label = 'معتمد'; cls = 'bg-emerald-100 text-emerald-700' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>
}

/** Shared cell renderer for both the interactive table and the print-only
 *  table below it, so the two never drift on how a value is displayed
 *  (the print view was briefly a plain `ar()` fallback that didn't know
 *  about `statusBadge`, showing a submitted doc's raw, pre-approval status). */
function cellValue(f: FieldDef, row: Row): ReactNode {
  if (f.statusBadge) return <DocBadge row={row} />
  if (f.statusDot) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${row[f.field] === f.statusDot.on ? 'bg-[var(--apex-green)]' : 'bg-slate-400'}`} />
        {row[f.field] === f.statusDot.on ? (f.statusDot.onLabel || 'نشط') : (f.statusDot.offLabel || 'غير نشط')}
      </span>
    )
  }
  if (f.type === 'checkbox') return row[f.field] ? 'نعم' : 'لا'
  return ar(row[f.field]) || (f.fallbackField ? row[f.fallbackField] : undefined) || '—'
}

/**
 * Apex list screen — same shape as the reference:
 *   toolbar (add · delete · print · filter · search) → table (☐ · م · data · إجراءات)
 *   → pagination (rows · page numbers · go-to-page).
 */
export function GenericListPage({ config }: { config: ListModuleConfig }) {
  const { toast } = useToast()
  const router = useRouter()
  const { company } = useCompanySafe()
  const { isAuthenticated, isLoading: authLoading } = useAuthSafe()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const [drawer, setDrawer] = useState<DrawerValues>({})
  const [printOpen, setPrintOpen] = useState(false)
  const [printRows, setPrintRows] = useState<Row[] | null>(null)
  const [pageInput, setPageInput] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Printing renders a dedicated print-only table (see the `hidden print:block`
  // block below) into `printRows`, then calls window.print(); once the print
  // dialog closes (or is cancelled) we restore the normal screen view.
  useEffect(() => {
    const restore = () => setPrintRows(null)
    window.addEventListener('afterprint', restore)
    return () => window.removeEventListener('afterprint', restore)
  }, [])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [bulkDelete, setBulkDelete] = useState(false)

  const bulkActive = async (on: boolean) => {
    if (!config.active) return
    setActionsOpen(false)
    let ok = 0
    if (config.requestActions) {
      // Submittable HR request docs: «تنشيط» = approve (submit), «إلغاء
      // التنشيط» = cancel — never a raw PUT on `status`.
      const method = on ? HR_REQUEST_METHOD.approve : HR_REQUEST_METHOD.cancel
      for (const name of selected) {
        try { await frappeClient.call(method, { doctype: config.doctype, name }); ok++ } catch { /* keep going */ }
      }
      toast({ title: on ? `تم اعتماد ${ok} طلب` : `تم إلغاء ${ok} طلب` })
      setSelected(new Set())
      load()
      return
    }
    const { field, on: onV, off } = config.active
    for (const name of selected) {
      try { await frappeClient.put(config.doctype, name, { [field]: on ? onV : off }); ok++ } catch { /* keep going */ }
    }
    toast({ title: on ? `تم تنشيط ${ok}` : `تم إلغاء تنشيط ${ok}` })
    setSelected(new Set())
    load()
  }

  /** Per-row اعتماد / رفض / إلغاء — only offered when config.requestActions. */
  const requestAction = async (action: 'approve' | 'reject' | 'cancel', row: Row) => {
    const method = HR_REQUEST_METHOD[action]
    try {
      await frappeClient.call(method, { doctype: config.doctype, name: row.name })
      toast({ title: action === 'approve' ? 'تم الاعتماد' : action === 'reject' ? 'تم الرفض' : 'تم الإلغاء' })
      load()
    } catch (e) {
      toast({ title: 'فشلت العملية', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    }
  }

  const confirmBulkDelete = async () => {
    setDeleting(true)
    let ok = 0, failed = 0
    for (const name of selected) {
      try {
        if (config.deleteMethod) await frappeClient.call(config.deleteMethod, { [config.deleteArgField || 'name']: name })
        else await frappeClient.delete(config.doctype, name)
        ok++
      } catch { failed++ }
    }
    setDeleting(false)
    setBulkDelete(false)
    setSelected(new Set())
    toast({ title: `تم حذف ${ok}`, description: failed ? `تعذّر حذف ${failed}` : undefined, variant: failed ? 'destructive' : undefined })
    load()
  }

  const tableFields = useMemo(() => config.fields.filter((f) => f.inTable !== false), [config.fields])
  const formFields = useMemo(() => config.fields.filter((f) => f.inForm !== false), [config.fields])

  const load = useCallback(async () => {
    // No session yet — don't fire the request; <SessionRenew /> reopens it.
    if (!authLoading && !isAuthenticated) {
      setRows([])
      setAuthRequired(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    setAuthRequired(false)
    try {
      const fieldNames = Array.from(new Set([...config.fields.map((f) => f.field), 'name']))
      const data = config.method
        ? ((await frappeClient.call<Row[]>(config.method)) as any)?.message ?? []
        : await frappeClient.getList<Row>(config.doctype, {
          fields: fieldNames,
          filters: config.filters,
          order_by: config.orderBy,
          limit_page_length: 0,
        })
      const list: Row[] = Array.isArray(data) ? data : []
      if (config.deriveFields) {
        for (const row of list) for (const d of config.deriveFields) row[d.as] = d.from(row)
      }
      setRows(list)
    } catch (e) {
      if (isAuthError(e)) {
        setRows([])
        setAuthRequired(true)
        setLoadError(false)
      } else {
        console.error(`Failed to load ${config.doctype}:`, e)
        setRows([])
        setLoadError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [config.doctype, config.method, config.fields, config.filters, config.orderBy, authLoading, isAuthenticated])

  useEffect(() => { if (!authLoading) load() }, [load, authLoading])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = config.drawerFilters ? applyDrawer(rows, config.drawerFilters, drawer) : rows
    if (!q) return base
    return base.filter((r) => tableFields.some((f) => String(r[f.field] ?? '').toLowerCase().includes(q)))
  }, [rows, search, tableFields, config.drawerFilters, drawer])

  /** An empty result while the user has a search/filter active gets the
   *  existing "search again" illustration; a genuinely empty list (nothing
   *  searched, nothing filtered) gets the plain EmptyState with an add
   *  action instead — the two used to share one (misleading) message. */
  const hasActiveFilter = search.trim().length > 0 || Object.values(drawer).some(Boolean)

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.name))

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) pageRows.forEach((r) => next.delete(r.name))
      else pageRows.forEach((r) => next.add(r.name))
      return next
    })
  }
  const toggleOne = (name: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  /** Fields actually live on the dialog for the given mode — `createOnly`
   *  fields (a one-time password, a role picker) never show up on edit. */
  const fieldsFor = (isEdit: boolean) => formFields.filter((f) => !(isEdit && f.createOnly))

  const openAdd = () => {
    if (config.addHref) { router.push(config.addHref); return }
    const initial: Record<string, any> = {}
    for (const f of fieldsFor(false)) initial[f.field] = f.type === 'checkbox' ? false : ''
    setEditing(null)
    setForm(initial)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const openEdit = (row: Row) => {
    if (config.editHref) { router.push(config.editHref(row.name)); return }
    const initial: Record<string, any> = {}
    for (const f of fieldsFor(true)) initial[f.field] = toFormValue(f, row[f.field])
    setEditing(row)
    setForm(initial)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const save = async () => {
    const isEdit = !!editing
    const activeFields = fieldsFor(isEdit)
    const errors: Record<string, string> = {}
    for (const f of activeFields) {
      if (f.required && !String(form[f.field] ?? '').trim()) errors[f.field] = 'هذا الحقل مطلوب'
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      const firstLabel = activeFields.find((f) => errors[f.field])?.label
      toast({ title: 'حقل مطلوب', description: firstLabel, variant: 'destructive' })
      return
    }
    setFieldErrors({})
    // `lockedOnEdit` fields (e.g. email) are shown disabled for context but
    // never sent back on PUT — the value on screen is already the row's own.
    const payloadFields = activeFields.filter((f) => !(isEdit && f.lockedOnEdit))
    let payload = toPayload(payloadFields, form)
    if (!isEdit && config.needsCompany && !payload.company) payload.company = company || undefined
    if (!isEdit && config.mapCreatePayload) payload = config.mapCreatePayload(payload)
    setSaving(true)
    try {
      let createResult: any
      if (editing) await frappeClient.put(config.doctype, editing.name, payload)
      else if (config.createMethod) createResult = (await frappeClient.call(config.createMethod, payload) as any)?.message
      else await frappeClient.post(config.doctype, payload)
      toast({
        title: editing ? 'تم التحديث' : 'تمت الإضافة',
        description: createResult?.server_ip
          ? `اضبط الجهاز الفعلي على: ${createResult.server_ip}:${createResult.server_port} (HTTP)`
          : undefined,
      })
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast({ title: 'فشل الحفظ', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (config.deleteMethod) {
        await frappeClient.call(config.deleteMethod, { [config.deleteArgField || 'name']: deleteTarget.name })
      } else {
        await frappeClient.delete(config.doctype, deleteTarget.name)
      }
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'فشل الحذف', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const goToPage = (v: string) => {
    if (!v.trim()) return
    const n = parseInt(v, 10)
    if (Number.isNaN(n) || n < 1) return
    setPage(Math.min(n, totalPages))
  }

  /** Reference-style page buttons: « ‹ 1 2 3 › » */
  const pageNumbers = useMemo(() => {
    const out: number[] = []
    const from = Math.max(1, currentPage - 2)
    const to = Math.min(totalPages, from + 4)
    for (let i = from; i <= to; i++) out.push(i)
    return out
  }, [currentPage, totalPages])

  const colSpan = tableFields.length + (config.noIndex ? 2 : 3) // checkbox + index + actions

  /** «طباعة الصفحة» prints just the current page's rows; «طباعة الكل» prints
   *  every row matching the active search/drawer filters (already fully
   *  loaded — the list always fetches with no server-side limit, see load()
   *  above — so no extra round-trip is needed to get "all" of them). Renders
   *  into the print-only table below, then triggers the browser print dialog;
   *  `afterprint` (registered above) restores the normal screen view. */
  const doPrint = (all: boolean) => {
    setPrintOpen(false)
    setPrintRows(all ? filtered : pageRows)
    requestAnimationFrame(() => window.print())
  }

  return (
    <div dir="rtl" className="space-y-3 p-4 font-[family-name:var(--font-arabic)]">

      {config.noteBanner && (
        <div className="flex items-start gap-2 rounded bg-blue-50 border border-blue-200 px-3 py-2.5 text-[12.5px] text-blue-900 leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{config.noteBanner}</span>
        </div>
      )}

      {/* ── Print-only view: just the title, date and table (see app/globals.css
          for the rules that hide the sidebar/topbar around it) ── */}
      {printRows && (
        <div className="hidden print:block">
          <h1 className="text-lg font-bold mb-1">{config.title}</h1>
          <p className="text-xs text-slate-500 mb-4">{new Date().toLocaleDateString('ar-EG')}</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {!config.noIndex && <th className="border border-slate-300 px-2 py-1 text-center">م</th>}
                {tableFields.map((f) => (
                  <th key={f.field} className="border border-slate-300 px-2 py-1 text-right">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printRows.map((row, i) => (
                <tr key={row.name}>
                  {!config.noIndex && <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>}
                  {tableFields.map((f) => (
                    <td key={f.field} className="border border-slate-300 px-2 py-1">
                      {cellValue(f, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden print:hidden">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 flex-wrap">
          {!config.readOnly && (
            <>
              <Button
                onClick={openAdd}
                className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white rounded px-4 h-9 font-bold text-[13px] shrink-0"
              >
                <Plus className="h-4 w-4 ml-1" strokeWidth={3} />
                {config.addLabel || 'اضافة'}
              </Button>
              {config.actionsMenu ? (
                <div className="relative shrink-0">
                  <Button
                    variant="outline"
                    disabled={selected.size === 0}
                    onClick={() => setActionsOpen((v) => !v)}
                    className="rounded px-4 h-9 font-bold text-[13px] border-[var(--apex-slate)] text-[var(--apex-slate)] disabled:opacity-50 min-w-[120px] justify-between"
                  >
                    الاجراءات
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                  </Button>
                  {actionsOpen && selected.size > 0 && (
                    <div className="absolute z-20 mt-1 w-40 rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]">
                      {config.active && (
                        <>
                          <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => bulkActive(true)}>تنشيط</button>
                          <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => bulkActive(false)}>إلغاء التنشيط</button>
                        </>
                      )}
                      <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50 text-red-600" onClick={() => { setActionsOpen(false); setBulkDelete(true) }}>حذف</button>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="outline"
                  disabled={selected.size === 0}
                  onClick={() => setBulkDelete(true)}
                  className="rounded px-4 h-9 font-bold text-[13px] shrink-0 border-[var(--apex-slate)] text-[var(--apex-slate)] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 ml-1" />
                  حذف
                </Button>
              )}
            </>
          )}

          {config.print !== false && <div className="relative shrink-0">
            <Button
              variant="outline"
              onClick={() => setPrintOpen((v) => !v)}
              className="rounded px-4 h-9 font-bold text-[13px] border-[var(--apex-slate)] text-[var(--apex-slate)]"
            >
              <Printer className="h-4 w-4 ml-1" />
              الطباعة
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
            </Button>
            {printOpen && (
              <div className="absolute z-20 mt-1 w-36 rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]">
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => doPrint(false)}>طباعة الصفحة</button>
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => doPrint(true)}>طباعة الكل</button>
              </div>
            )}
          </div>}

          {!!config.drawerFilters?.length && (
            <Button
              variant="outline"
              onClick={() => setShowFilter(true)}
              title="تصفية"
              className={`rounded h-9 w-9 p-0 shrink-0 border-[var(--apex-blue-light)] ${Object.values(drawer).some(Boolean) ? 'bg-[var(--apex-blue-light)] text-white hover:bg-[var(--apex-blue-light)]' : 'text-[var(--apex-blue)]'}`}
            >
              <Filter className="h-4 w-4" />
            </Button>
          )}

          <div className="relative flex-1 min-w-[180px]">
            <Input
              ref={searchRef}
              placeholder={config.searchPlaceholder || 'ابحث بالاسم'}
              aria-label={config.searchPlaceholder || 'ابحث بالاسم'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-9 rounded border-slate-300 text-right pr-9 placeholder:text-slate-400"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          </div>
        </div>

        {authRequired && !loading && (
          <div className="mx-3 mt-3"><SessionRenew /></div>
        )}

        {loadError && !loading && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>تعذّر تحميل البيانات من الخادم. تأكد من الاتصال ثم أعد المحاولة.</span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-right">
            <thead>
              <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
                {!config.readOnly && (
                  <th className="px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                      aria-label="تحديد الكل"
                    />
                  </th>
                )}
                {!config.noIndex && <th className="px-3 w-10 text-center font-bold">م</th>}
                {tableFields.map((f) => (
                  <th key={f.field} className="px-3 font-bold whitespace-nowrap">{f.label}</th>
                ))}
                <th className="px-3 font-bold w-32 text-center whitespace-nowrap">الاجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan} className="p-0"><TableSkeleton rows={6} cols={colSpan} /></td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={colSpan} className="py-10">
                  {config.emptyText ? (
                    <div className="flex flex-col items-center gap-6 py-6">
                      <BoxIllustration />
                      <p className="text-[18px] font-bold text-slate-800">{config.emptyText}</p>
                      {config.emptyAction && !config.readOnly && (
                        <button type="button" onClick={openAdd} className="h-[42px] px-5 rounded bg-[var(--apex-green)] text-white text-[15px] flex items-center gap-2 hover:bg-[var(--apex-green-dark)]">
                          <Plus className="h-4 w-4" strokeWidth={3} />{config.emptyAction}
                        </button>
                      )}
                    </div>
                  ) : hasActiveFilter ? (
                    <ApexEmptyState />
                  ) : (
                    <EmptyState
                      title="لا توجد بيانات بعد"
                      description="لم تتم إضافة أي سجل لهذه القائمة حتى الآن."
                      action={!config.readOnly ? (
                        <button
                          type="button"
                          onClick={openAdd}
                          className="h-9 px-4 rounded bg-[var(--apex-green)] text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-[var(--apex-green-dark)]"
                        >
                          <Plus className="h-4 w-4" strokeWidth={3} />{config.addLabel || 'اضافة'}
                        </button>
                      ) : undefined}
                    />
                  )}
                </td></tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr key={row.name} className="border-b border-slate-100 hover:bg-slate-50/70 h-[52px]">
                    {!config.readOnly && (
                      <td className="px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(row.name)}
                          onChange={() => toggleOne(row.name)}
                          className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                          aria-label={`تحديد ${row.name}`}
                        />
                      </td>
                    )}
                    {!config.noIndex && <td className="px-3 text-center text-slate-500">{(currentPage - 1) * pageSize + i + 1}</td>}
                    {tableFields.map((f) => (
                      <td key={f.field} className="px-3 text-slate-700">
                        {config.linkField === f.field && config.editHref ? (
                          <button type="button" onClick={() => openEdit(row)} className="text-[var(--apex-blue)] hover:underline">{row[f.field] ?? '—'}</button>
                        ) : cellValue(f, row)}
                      </td>
                    ))}
                    <td className="px-3">
                      {/* Apex order (RTL, from the right): ✎ · 🗑 · ⋮ */}
                      <div className="flex items-center justify-center gap-1">
                        {!config.readOnly && (
                          <>
                            <button onClick={() => openEdit(row)} title="تعديل" className="text-[var(--apex-green)] hover:text-[var(--apex-green-text)] px-1"><Pencil className="h-[17px] w-[17px]" /></button>
                            <button onClick={() => setDeleteTarget(row)} title="حذف" className="text-slate-400 hover:text-red-600 px-1"><Trash2 className="h-[17px] w-[17px]" /></button>
                          </>
                        )}
                        {(!config.readOnly || config.requestActions) && (
                          <DropdownMenu dir="rtl">
                            <DropdownMenuTrigger asChild>
                              <button
                                title="خيارات"
                                aria-label="خيارات"
                                className="text-slate-500 hover:text-slate-700 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--apex-blue)] focus-visible:ring-offset-1"
                              >
                                <MoreVertical className="h-[18px] w-[18px]" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-[13px] min-w-[140px]">
                              {!config.readOnly && <DropdownMenuItem onClick={() => openEdit(row)}>تعديل</DropdownMenuItem>}
                              {!config.readOnly && (
                                <DropdownMenuItem onClick={() => setDeleteTarget(row)} className="text-red-600 focus:text-red-600">حذف</DropdownMenuItem>
                              )}
                              {config.requestActions && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => requestAction('approve', row)}>اعتماد</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => requestAction('reject', row)}>رفض</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => requestAction('cancel', row)} className="text-red-600 focus:text-red-600">إلغاء</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-3 py-3 text-[13px]">
          <div className="flex items-center gap-2 order-2 lg:order-1">
            <span className="font-bold text-slate-700">عدد الصفوف</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger aria-label="عدد الصفوف" className="w-[70px] h-9 rounded border-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 order-1 lg:order-2">
            <button onClick={() => setPage(1)} disabled={currentPage === 1} aria-label="الصفحة الأولى" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40">«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="الصفحة السابقة" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronRight className="h-4 w-4 mx-auto" /></button>
            {pageNumbers.map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`h-8 min-w-8 px-2 rounded border text-[13px] font-bold ${n === currentPage ? 'bg-[var(--apex-blue-light)] border-[var(--apex-blue-light)] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="الصفحة التالية" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronLeft className="h-4 w-4 mx-auto" /></button>
            <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="الصفحة الأخيرة" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40">»</button>
          </div>

          <div className="flex items-center gap-2 order-3">
            <span className="text-slate-600">اذهب إلى صفحة</span>
            <Input
              type="number"
              min={1}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { goToPage(pageInput); setPageInput('') } }}
              className="w-16 h-9 rounded border-slate-300 text-center"
              inputMode="numeric"
              aria-label="رقم الصفحة"
            />
            <button className="text-[var(--apex-blue-light)] font-bold hover:underline" onClick={() => { goToPage(pageInput); setPageInput('') }}>اذهب</button>
          </div>
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `تعديل — ${config.title}` : config.addLabel || 'اضافة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {fieldsFor(!!editing).map((f) => (
              <div key={f.field} className="space-y-1.5">
                {f.type !== 'checkbox' && (
                  <Label className="text-[13px] text-slate-600">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </Label>
                )}
                {editing && f.lockedOnEdit ? (
                  <Input value={form[f.field] ?? ''} disabled className="rounded-sm border-slate-300 text-right bg-slate-50 text-slate-500" />
                ) : (
                  <FieldInput
                    field={f}
                    value={form[f.field]}
                    error={fieldErrors[f.field]}
                    onChange={(v) => {
                      setForm((prev) => ({ ...prev, [f.field]: v }))
                      setFieldErrors((prev) => (prev[f.field] ? { ...prev, [f.field]: '' } : prev))
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={save} disabled={saving} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white">
              {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="تأكيد الحذف"
        description={deleteTarget ? `سيتم حذف السجل "${deleteTarget.name}" نهائياً.` : ''}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        loading={deleting}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title="حذف السجلات المحددة"
        description={`سيتم حذف ${selected.size} سجل نهائياً.`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={deleting}
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
      {config.drawerFilters && (
        <AdvancedSearchDrawer open={showFilter} onClose={() => setShowFilter(false)} filters={config.drawerFilters} values={drawer} onApply={(v) => { setDrawer(v); setPage(1) }} />
      )}
    </div>
  )
}
