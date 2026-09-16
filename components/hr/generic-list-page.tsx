'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Pencil, Trash2, MoreVertical, Loader2, Printer,
  ChevronDown, ChevronRight, ChevronLeft, Filter, AlertCircle,
} from 'lucide-react'
import { frappeClient, isAuthError } from '@/lib/api-client'
import { SessionRenew } from '@/components/login-page'
import { useAuthSafe } from '@/lib/auth-context'
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
import { FieldInput, toFormValue, toPayload } from '@/components/hr/field-input'
import type { ListModuleConfig } from '@/lib/hr-modules'
import { ApexEmptyState, BoxIllustration } from '@/components/hr/apex-empty-state'
import { AdvancedSearchDrawer, applyDrawer, type DrawerValues } from '@/components/hr/advanced-search-drawer'

type Row = Record<string, any> & { name: string }

const PAGE_SIZES = [5, 10, 20, 50]

/** Arabic labels for the Frappe status values that show up in list cells. */
const VALUE_AR: Record<string, string> = {
  Approved: 'معتمد', Rejected: 'مرفوض', Open: 'مفتوح', Cancelled: 'ملغي', Draft: 'مسودة', Pending: 'قيد الانتظار',
  Active: 'نشط', Inactive: 'غير نشط', Suspended: 'موقوف', Left: 'منتهي', Completed: 'مكتمل', Working: 'قيد العمل',
  'Pending Review': 'قيد المراجعة', Low: 'منخفضة', Medium: 'متوسطة', High: 'عالية', Urgent: 'عاجلة',
  'Work From Home': 'عمل من المنزل', 'On Duty': 'مهمة عمل',
}
const ar = (v: any) => (typeof v === 'string' && VALUE_AR[v]) || v

/**
 * Apex list screen — same shape as the reference:
 *   toolbar (add · delete · print · filter · search) → table (☐ · م · data · إجراءات)
 *   → pagination (rows · page numbers · go-to-page).
 */
export function GenericListPage({ config }: { config: ListModuleConfig }) {
  const { toast } = useToast()
  const router = useRouter()
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
  const searchRef = useRef<HTMLInputElement>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [bulkDelete, setBulkDelete] = useState(false)

  const bulkActive = async (on: boolean) => {
    if (!config.active) return
    setActionsOpen(false)
    const { field, on: onV, off } = config.active
    let ok = 0
    for (const name of selected) {
      try { await frappeClient.put(config.doctype, name, { [field]: on ? onV : off }); ok++ } catch { /* keep going */ }
    }
    toast({ title: on ? `تم تنشيط ${ok}` : `تم إلغاء تنشيط ${ok}` })
    setSelected(new Set())
    load()
  }

  const confirmBulkDelete = async () => {
    setDeleting(true)
    let ok = 0, failed = 0
    for (const name of selected) {
      try { await frappeClient.delete(config.doctype, name); ok++ } catch { failed++ }
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
      setRows(Array.isArray(data) ? data : [])
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

  const openAdd = () => {
    if (config.addHref) { router.push(config.addHref); return }
    const initial: Record<string, any> = {}
    for (const f of formFields) initial[f.field] = f.type === 'checkbox' ? false : ''
    setEditing(null)
    setForm(initial)
    setDialogOpen(true)
  }

  const openEdit = (row: Row) => {
    if (config.editHref) { router.push(config.editHref(row.name)); return }
    const initial: Record<string, any> = {}
    for (const f of formFields) initial[f.field] = toFormValue(f, row[f.field])
    setEditing(row)
    setForm(initial)
    setDialogOpen(true)
  }

  const save = async () => {
    for (const f of formFields) {
      if (f.required && !String(form[f.field] ?? '').trim()) {
        toast({ title: 'حقل مطلوب', description: f.label, variant: 'destructive' })
        return
      }
    }
    const payload = toPayload(formFields, form)
    setSaving(true)
    try {
      if (editing) await frappeClient.put(config.doctype, editing.name, payload)
      else await frappeClient.post(config.doctype, payload)
      toast({ title: editing ? 'تم التحديث' : 'تمت الإضافة' })
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
      await frappeClient.delete(config.doctype, deleteTarget.name)
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'فشل الحذف', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const goToPage = (v: string) => {
    const n = parseInt(v, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= totalPages) setPage(n)
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

  return (
    <div dir="rtl" className="space-y-3 p-4 font-[family-name:var(--font-arabic)]">

      <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 flex-wrap">
          {!config.readOnly && (
            <>
              <Button
                onClick={openAdd}
                className="bg-[#28a745] hover:bg-[#218838] text-white rounded px-4 h-9 font-bold text-[13px] shrink-0"
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
                    className="rounded px-4 h-9 font-bold text-[13px] border-slate-300 text-slate-500 disabled:text-slate-300 min-w-[120px] justify-between"
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
                  className="rounded px-4 h-9 font-bold text-[13px] shrink-0 border-slate-300 text-red-500 disabled:text-slate-300"
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
              className="rounded px-4 h-9 font-bold text-[13px] border-slate-300"
            >
              <Printer className="h-4 w-4 ml-1" />
              الطباعة
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
            </Button>
            {printOpen && (
              <div className="absolute z-20 mt-1 w-36 rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]">
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => { setPrintOpen(false); window.print() }}>طباعة الصفحة</button>
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => { setPrintOpen(false); window.print() }}>طباعة الكل</button>
              </div>
            )}
          </div>}

          <Button
            variant="outline"
            onClick={() => { if (config.drawerFilters) setShowFilter(true); else searchRef.current?.focus() }}
            title="تصفية"
            className={`rounded h-9 w-9 p-0 shrink-0 border-slate-300 ${Object.values(drawer).some(Boolean) ? 'bg-[#2e71c8] text-white hover:bg-[#2e71c8]' : 'text-[#2e71c8]'}`}
          >
            <Filter className="h-4 w-4" />
          </Button>

          <div className="relative flex-1 min-w-[180px]">
            <Input
              ref={searchRef}
              placeholder={config.searchPlaceholder || 'ابحث بالاسم'}
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
              <tr className="bg-[#cfd8e3] text-slate-700 border-y border-slate-300 h-11">
                {!config.readOnly && (
                  <th className="px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-[#2e71c8] cursor-pointer align-middle"
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
                <tr><td colSpan={colSpan} className="py-14 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#2e71c8] mx-auto" /></td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={colSpan} className="py-10">
                  {config.emptyText ? (
                    <div className="flex flex-col items-center gap-6 py-6">
                      <BoxIllustration />
                      <p className="text-[18px] font-bold text-slate-800">{config.emptyText}</p>
                      {config.emptyAction && !config.readOnly && (
                        <button type="button" onClick={openAdd} className="h-[42px] px-5 rounded bg-[#3d9b6a] text-white text-[15px] flex items-center gap-2 hover:bg-[#35895d]">
                          <Plus className="h-4 w-4" strokeWidth={3} />{config.emptyAction}
                        </button>
                      )}
                    </div>
                  ) : <ApexEmptyState />}
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
                          className="h-4 w-4 accent-[#2e71c8] cursor-pointer align-middle"
                          aria-label={`تحديد ${row.name}`}
                        />
                      </td>
                    )}
                    {!config.noIndex && <td className="px-3 text-center text-slate-500">{(currentPage - 1) * pageSize + i + 1}</td>}
                    {tableFields.map((f) => (
                      <td key={f.field} className="px-3 text-slate-700">
                        {f.statusDot ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${row[f.field] === f.statusDot.on ? 'bg-[#28a745]' : 'bg-slate-400'}`} />
                            {row[f.field] === f.statusDot.on ? (f.statusDot.onLabel || 'نشط') : (f.statusDot.offLabel || 'غير نشط')}
                          </span>
                        ) : config.linkField === f.field && config.editHref ? (
                          <button type="button" onClick={() => openEdit(row)} className="text-[#2960b6] hover:underline">{row[f.field] ?? '—'}</button>
                        ) : f.type === 'checkbox' ? (row[f.field] ? 'نعم' : 'لا') : (ar(row[f.field]) || (f.fallbackField ? row[f.fallbackField] : undefined) || '—')}
                      </td>
                    ))}
                    <td className="px-3">
                      {/* Apex order (RTL, from the right): ✎ · 🗑 · ⋮ */}
                      <div className="flex items-center justify-center gap-1">
                        {!config.readOnly && (
                          <>
                            <button onClick={() => openEdit(row)} title="تعديل" className="text-[#28a745] hover:text-[#1e7e34] px-1"><Pencil className="h-[17px] w-[17px]" /></button>
                            <button onClick={() => setDeleteTarget(row)} title="حذف" className="text-slate-400 hover:text-red-600 px-1"><Trash2 className="h-[17px] w-[17px]" /></button>
                          </>
                        )}
                        <button title="خيارات" className="text-slate-500 hover:text-slate-700 px-1"><MoreVertical className="h-[18px] w-[18px]" /></button>
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
              <SelectTrigger className="w-[70px] h-9 rounded border-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 order-1 lg:order-2">
            <button onClick={() => setPage(1)} disabled={currentPage === 1} className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40">«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronRight className="h-4 w-4 mx-auto" /></button>
            {pageNumbers.map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`h-8 min-w-8 px-2 rounded border text-[13px] font-bold ${n === currentPage ? 'bg-[#2e71c8] border-[#2e71c8] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronLeft className="h-4 w-4 mx-auto" /></button>
            <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40">»</button>
          </div>

          <div className="flex items-center gap-2 order-3">
            <span className="text-slate-600">اذهب إلى صفحة</span>
            <Input onKeyDown={(e) => { if (e.key === 'Enter') goToPage((e.target as HTMLInputElement).value) }}
              className="w-16 h-9 rounded border-slate-300 text-center" inputMode="numeric" />
            <button className="text-[#2e71c8] font-bold hover:underline" onClick={() => { const el = document.activeElement as HTMLInputElement | null; if (el && el.tagName === 'INPUT') goToPage(el.value) }}>اذهب</button>
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
            {formFields.map((f) => (
              <div key={f.field} className="space-y-1.5">
                {f.type !== 'checkbox' && (
                  <Label className="text-[13px] text-slate-600">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </Label>
                )}
                <FieldInput field={f} value={form[f.field]} onChange={(v) => setForm((prev) => ({ ...prev, [f.field]: v }))} />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={save} disabled={saving} className="bg-[#28a745] hover:bg-[#218838] text-white">
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
