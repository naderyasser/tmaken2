'use client'

/**
 * «دوام ورديات المصنع المتغير» (Apex M2, `hr/RotationalShifts`) — the list
 * of rotational shift groups. Columns/toolbar mirror
 * components/hr/generic-list-page.tsx's Apex look; a bespoke component
 * (not GenericListPage) because two columns here are server-computed
 * counts, and add/edit always navigate to the full-page editor rather than
 * a dialog. Backed by base_meena.api.hr_rotational_shifts.
 * See apex-gap-analysis.md §1 M2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Pencil, Trash2, ChevronDown, ChevronRight, ChevronLeft, Printer, AlertCircle } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtDate, fmtNumber } from '@/lib/hr-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ApexEmptyState, BoxIllustration } from '@/components/hr/apex-empty-state'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'
import type { RotationalGroupListRow } from '@/components/hr/rotational/types'

const PAGE_SIZES = [5, 10, 20, 50]
const TITLE = 'دوام ورديات المصنع المتغير'

export function RotationalShiftsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<RotationalGroupListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionsOpen, setActionsOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [printRows, setPrintRows] = useState<RotationalGroupListRow[] | null>(null)
  const [pageInput, setPageInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RotationalGroupListRow | null>(null)
  const [bulkDelete, setBulkDelete] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const restore = () => setPrintRows(null)
    window.addEventListener('afterprint', restore)
    return () => window.removeEventListener('afterprint', restore)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.list_groups', {})
      setRows(Array.isArray(res?.message) ? res.message : [])
    } catch (e) {
      console.error('Failed to load rotational shift groups:', e)
      setRows([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => (r.group_name || '').toLowerCase().includes(q))
  }, [rows, search])

  const hasActiveFilter = search.trim().length > 0
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.name))

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev)
    if (allChecked) pageRows.forEach((r) => next.delete(r.name))
    else pageRows.forEach((r) => next.add(r.name))
    return next
  })
  const toggleOne = (name: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  const goEdit = (row: RotationalGroupListRow) => router.push(`/rotational-shifts/${encodeURIComponent(row.name)}`)

  const deleteOne = async (name: string) => {
    await frappeClient.call('base_meena.api.hr_rotational_shifts.delete_group', { name })
  }

  const confirmDeleteOne = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteOne(deleteTarget.name)
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const confirmBulkDelete = async () => {
    setDeleting(true)
    let ok = 0, failed = 0
    for (const name of selected) {
      try { await deleteOne(name); ok++ } catch { failed++ }
    }
    setDeleting(false)
    setBulkDelete(false)
    setSelected(new Set())
    toast({ title: `تم حذف ${ok}`, description: failed ? `تعذّر حذف ${failed}` : undefined, variant: failed ? 'destructive' : undefined })
    load()
  }

  const goToPage = (v: string) => {
    if (!v.trim()) return
    const n = parseInt(v, 10)
    if (Number.isNaN(n) || n < 1) return
    setPage(Math.min(n, totalPages))
  }
  const pageNumbers = useMemo(() => {
    const out: number[] = []
    const from = Math.max(1, currentPage - 2)
    const to = Math.min(totalPages, from + 4)
    for (let i = from; i <= to; i++) out.push(i)
    return out
  }, [currentPage, totalPages])

  const doPrint = (all: boolean) => {
    setPrintOpen(false)
    setPrintRows(all ? filtered : pageRows)
    requestAnimationFrame(() => window.print())
  }

  const colSpan = 8 // checkbox + index + 5 data columns + actions

  return (
    <div dir="rtl" className="space-y-3 p-4 font-[family-name:var(--font-arabic)]">

      {printRows && (
        <div className="hidden print:block">
          <h1 className="text-lg font-bold mb-1">{TITLE}</h1>
          <p className="text-xs text-slate-500 mb-4">{fmtDate(new Date())}</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-center">م</th>
                <th className="border border-slate-300 px-2 py-1 text-right">إسم مجموعة الدوام</th>
                <th className="border border-slate-300 px-2 py-1 text-right">تاريخ بدء العمل بالدوام</th>
                <th className="border border-slate-300 px-2 py-1 text-right">عدد أيام الدوام</th>
                <th className="border border-slate-300 px-2 py-1 text-right">أيام الراحة</th>
                <th className="border border-slate-300 px-2 py-1 text-right">الورديات</th>
                <th className="border border-slate-300 px-2 py-1 text-right">الموظفون</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map((row, i) => (
                <tr key={row.name}>
                  <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                  <td className="border border-slate-300 px-2 py-1">{row.group_name}</td>
                  <td className="border border-slate-300 px-2 py-1">{row.start_date ? fmtDate(row.start_date) : '—'}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtNumber(row.cycle_days)}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtNumber(row.days_off)}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtNumber(row.shifts_count)}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtNumber(row.employees_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden print:hidden">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 flex-wrap">
          <Button
            onClick={() => router.push('/rotational-shifts/new')}
            className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white rounded px-4 h-9 font-bold text-[13px] shrink-0"
          >
            <Plus className="h-4 w-4 ml-1" strokeWidth={3} />
            إضافة مجموعة دوام
          </Button>

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
              <div className="absolute z-20 mt-1 w-36 rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]">
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50 text-red-600" onClick={() => { setActionsOpen(false); setBulkDelete(true) }}>حذف</button>
              </div>
            )}
          </div>

          <div className="relative shrink-0">
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
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Input
              ref={searchRef}
              placeholder="إبحث بإسم الدوام"
              aria-label="إبحث بإسم الدوام"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-9 rounded border-slate-300 text-right pr-9 placeholder:text-slate-400"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          </div>
        </div>

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
                <th className="px-3 w-10 text-center">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="تحديد الكل" className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" />
                </th>
                <th className="px-3 w-10 text-center font-bold">م</th>
                <th className="px-3 font-bold whitespace-nowrap">إسم مجموعة الدوام</th>
                <th className="px-3 font-bold whitespace-nowrap">تاريخ بدء العمل بالدوام</th>
                <th className="px-3 font-bold whitespace-nowrap">عدد أيام الدوام</th>
                <th className="px-3 font-bold whitespace-nowrap">أيام الراحة</th>
                <th className="px-3 font-bold whitespace-nowrap">الورديات</th>
                <th className="px-3 font-bold whitespace-nowrap">الموظفون</th>
                <th className="px-3 font-bold w-32 text-center whitespace-nowrap">الاجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan} className="p-0"><TableSkeleton rows={6} cols={colSpan} /></td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={colSpan} className="py-10">
                  {hasActiveFilter ? (
                    <ApexEmptyState />
                  ) : rows.length === 0 && !loadError ? (
                    <div className="flex flex-col items-center gap-6 py-6">
                      <BoxIllustration />
                      <p className="text-[18px] font-bold text-slate-800">لا توجد مجموعات دوام بعد</p>
                      <button type="button" onClick={() => router.push('/rotational-shifts/new')} className="h-[42px] px-5 rounded bg-[var(--apex-green)] text-white text-[15px] flex items-center gap-2 hover:bg-[var(--apex-green-dark)]">
                        <Plus className="h-4 w-4" strokeWidth={3} />إضافة مجموعة دوام
                      </button>
                    </div>
                  ) : (
                    <EmptyState title="لا توجد بيانات بعد" description="لم تتم إضافة أي سجل لهذه القائمة حتى الآن." />
                  )}
                </td></tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr key={row.name} className="border-b border-slate-100 hover:bg-slate-50/70 h-[52px]">
                    <td className="px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.name)}
                        onChange={() => toggleOne(row.name)}
                        aria-label={`تحديد ${row.group_name}`}
                        className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                      />
                    </td>
                    <td className="px-3 text-center text-slate-500">{(currentPage - 1) * pageSize + i + 1}</td>
                    <td className="px-3 text-slate-700">
                      <button type="button" onClick={() => goEdit(row)} className="text-[var(--apex-blue)] hover:underline">{row.group_name || '—'}</button>
                    </td>
                    <td className="px-3 text-slate-700">{row.start_date ? fmtDate(row.start_date) : '—'}</td>
                    <td className="px-3 text-slate-700">{fmtNumber(row.cycle_days)}</td>
                    <td className="px-3 text-slate-700">{fmtNumber(row.days_off)}</td>
                    <td className="px-3 text-slate-700">{fmtNumber(row.shifts_count)}</td>
                    <td className="px-3 text-slate-700">{fmtNumber(row.employees_count)}</td>
                    <td className="px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => goEdit(row)} title="تعديل" className="text-[var(--apex-green)] hover:text-[var(--apex-green-text)] px-1"><Pencil className="h-[17px] w-[17px]" /></button>
                        <button onClick={() => setDeleteTarget(row)} title="حذف" className="text-slate-400 hover:text-red-600 px-1"><Trash2 className="h-[17px] w-[17px]" /></button>
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
              className="w-[50px] h-9 rounded text-center px-1 border-[var(--apex-slate)]"
              inputMode="numeric"
              aria-label="رقم الصفحة"
            />
            <button className="text-[var(--apex-blue-light)] font-bold hover:underline" onClick={() => { goToPage(pageInput); setPageInput('') }}>اذهب</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="تأكيد الحذف"
        description="هل تريد حذف الدوام؟"
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        loading={deleting}
        onConfirm={confirmDeleteOne}
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
    </div>
  )
}
