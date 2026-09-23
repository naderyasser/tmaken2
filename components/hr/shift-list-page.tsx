'use client'

/**
 * «أوقات العمل» (Apex `hr/shiftslist`, §5.6) — the shift list screen. Bespoke
 * (not GenericListPage): add/edit use the SMALL Apex dialog (G9, name+kind
 * only — save_shift_meta) instead of the generic field-list dialog, and the
 * name link + pencil both route through the full-page day editor
 * (shift-editor-page.tsx) rather than a generic form. Rows come from the
 * existing base_meena.api.hr_lists.shifts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { ApexEmptyState } from '@/components/hr/apex-empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RowMenu } from '@/components/hr/apex/row-menu'
import { ViewRecordDialog } from '@/components/hr/apex/view-record-dialog'
import { VersionLogDialog } from '@/components/hr/apex/version-log-dialog'
import { KIND_LABELS, KIND_OPTIONS, type ShiftKind } from '@/components/hr/shift-editor/types'

interface Row {
  name: string
  custom_shift_kind?: string | null
  /** From base_meena.api.hr_lists.shifts — true when some Employee has this
   *  as its default_shift (one grouped query server-side, never per-row). */
  in_use?: boolean
}

interface MetaForm {
  name?: string
  arabic_name: string
  latin_name: string
  kind: ShiftKind
}

const EMPTY_FORM: MetaForm = { arabic_name: '', latin_name: '', kind: 'Normal' }
const PAGE_SIZES = [5, 10, 20, 50]
const FIELD = 'w-full h-[44px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

export function ShiftListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<MetaForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [viewRow, setViewRow] = useState<Row | null>(null)
  const [historyRow, setHistoryRow] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_lists.shifts', {})
      setRows(Array.isArray(res?.message) ? res.message : [])
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل أوقات العمل', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])
  useEffect(() => { load() }, [load])

  // /shift-management?add=1 (from the retired /shift-management/new route) —
  // open the add dialog immediately instead of landing on a blank page.
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setForm(EMPTY_FORM)
      setDialogMode('add')
      router.replace('/shift-management')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, search])

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

  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    let ok = 0, failed = 0
    for (const name of selected) {
      try {
        await frappeClient.call('base_meena.api.hr_shifts.delete_shift', { name })
        ok++
      } catch { failed++ }
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelected(new Set())
    toast({
      title: `تم حذف ${ok}`,
      description: failed ? `تعذّر حذف ${failed} — تأكد من عدم وجود موظفين على هذه الأوقات` : undefined,
      variant: failed ? 'destructive' : undefined,
    })
    await load()
  }

  const openAdd = () => { setForm(EMPTY_FORM); setDialogMode('add') }
  const openEdit = (row: Row) => {
    setForm({
      name: row.name,
      arabic_name: row.name,
      latin_name: '',
      kind: (row.custom_shift_kind as ShiftKind) || 'Normal',
    })
    setDialogMode('edit')
  }

  const saveMeta = async () => {
    if (!form.arabic_name.trim()) {
      toast({ title: 'حقول مطلوبة', description: 'اسم الدوام بالعربية مطلوب', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_shifts.save_shift_meta', {
        name: form.name,
        arabic_name: form.arabic_name.trim(),
        latin_name: form.latin_name || '',
        kind: form.kind,
      })
      const isAdd = dialogMode === 'add'
      setDialogMode(null)
      if (isAdd) {
        const newName = res?.message?.name
        toast({ title: 'تم إضافة الدوام' })
        if (newName) router.push(`/shift-management/${encodeURIComponent(newName)}`)
      } else {
        toast({ title: 'تم تعديل الدوام' })
        await load()
      }
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await frappeClient.call('base_meena.api.hr_shifts.delete_shift', { name: deleteTarget.name })
      toast({ title: 'تم حذف الدوام' })
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast({ title: 'تعذّر الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="px-4 pt-2 pb-8" dir="rtl">
      {/* breadcrumb — Apex S9: «البيانات الاساسية / أوقات العمل» (missing on tamken3 before this batch) */}
      <div className="text-[14px] mb-4">
        <span className="text-slate-600">البيانات الاساسية</span>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-bold">أوقات العمل</span>
      </div>

      <ApexToolbar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: 'إبحث بإسم الدوام' }}
        actions={{
          disabled: selected.size === 0,
          items: [{ label: 'حذف', onSelect: () => setBulkDeleteOpen(true) }],
        }}
        add={{ label: 'إضافة دوام', onClick: openAdd }}
      />

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : filtered.length === 0 ? (
        <ApexEmptyState />
      ) : (
        <>
          <ApexTableCard>
            <table className="apex-table w-full border-collapse">
              <thead>
                <tr className="bg-[var(--apex-thead)]">
                  <th className="w-10 border-b border-slate-200">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer align-middle accent-[var(--apex-blue-light)]"
                      aria-label="تحديد الكل"
                    />
                  </th>
                  <th className="px-3 py-2 text-[14px] font-bold text-[var(--apex-text)] border-b border-slate-200">إسم الدوام</th>
                  <th className="px-3 py-2 text-[14px] font-bold text-[var(--apex-text)] border-b border-slate-200">نوع الدوام</th>
                  <th className="px-3 py-2 text-[14px] font-bold text-[var(--apex-text)] border-b border-slate-200 text-center">الاجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const canDelete = !row.in_use
                  return (
                    <tr key={row.name}>
                      <td className="border-b border-slate-100 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(row.name)}
                          onChange={() => toggleOne(row.name)}
                          className="h-4 w-4 cursor-pointer align-middle accent-[var(--apex-blue-light)]"
                          aria-label={`تحديد ${row.name}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-[14px] border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => router.push(`/shift-management/${encodeURIComponent(row.name)}`)}
                          className="hover:underline"
                          style={{ color: 'rgb(0, 123, 255)', fontSize: '14px', fontWeight: 400 }}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-[14px] text-[var(--apex-text)] border-b border-slate-100">
                        {KIND_LABELS[row.custom_shift_kind || 'Normal'] || KIND_LABELS.Normal}
                      </td>
                      <td className="apex-col-actions px-3 py-1.5 border-b border-slate-100">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => openEdit(row)} title="تعديل" aria-label={`تعديل ${row.name}`} className="apex-icon-edit px-1 hover:opacity-75">
                            <Pencil className="h-[17px] w-[17px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => canDelete && setDeleteTarget(row)}
                            disabled={!canDelete}
                            title="حذف"
                            aria-label={`حذف ${row.name}`}
                            className={`apex-icon-delete px-1 ${canDelete ? 'hover:opacity-75' : 'is-disabled cursor-not-allowed'}`}
                          >
                            <Trash2 className="h-[17px] w-[17px]" />
                          </button>
                          <RowMenu
                            kind="master"
                            onView={() => setViewRow(row)}
                            onHistory={() => setHistoryRow(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ApexTableCard>

          <ApexPagination
            page={currentPage}
            pageCount={totalPages}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
          />
        </>
      )}

      <ApexDialog
        open={dialogMode !== null}
        onOpenChange={(o) => { if (!o) setDialogMode(null) }}
        title={dialogMode === 'add' ? 'إضافة دوام' : 'تعديل دوام'}
        size="sm"
        primary={{
          label: dialogMode === 'add' ? 'إضافة' : 'تعديل',
          onClick: saveMeta,
          disabled: saving,
          loading: saving,
        }}
      >
        <div className="col-span-2 space-y-4">
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">اسم الدوام بالعربية<span className="text-red-500"> *</span></span>
            <input
              value={form.arabic_name}
              onChange={(e) => setForm((p) => ({ ...p, arabic_name: e.target.value }))}
              placeholder="اسم الدوام بالعربية"
              className={FIELD}
            />
          </div>
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">اسم الدوام بالانجليزية</span>
            <input
              value={form.latin_name}
              onChange={(e) => setForm((p) => ({ ...p, latin_name: e.target.value }))}
              placeholder="اسم الدوام بالانجليزية"
              className={FIELD}
            />
          </div>
          <div>
            <span className="block text-[13px] text-slate-700 mb-2">نوع الدوام</span>
            <div className="flex items-center gap-5 flex-wrap">
              {KIND_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-1.5 text-[13.5px] text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="shift_kind"
                    checked={form.kind === o.value}
                    onChange={() => setForm((p) => ({ ...p, kind: o.value }))}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </ApexDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="هل تريد حذف الدوام؟"
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="حذف أوقات العمل المحددة"
        description={`سيتم حذف ${selected.size} دوام نهائياً.`}
        confirmLabel={bulkDeleting ? 'جاري الحذف…' : 'حذف'}
        cancelLabel="إلغاء"
        variant="destructive"
        loading={bulkDeleting}
        onConfirm={confirmBulkDelete}
      />

      {viewRow && (
        <ViewRecordDialog
          open={!!viewRow}
          onOpenChange={(o) => { if (!o) setViewRow(null) }}
          title="أوقات العمل"
          fields={[
            { label: 'اسم الدوام', value: viewRow.name },
            { label: 'نوع الدوام', value: KIND_LABELS[viewRow.custom_shift_kind || 'Normal'] || KIND_LABELS.Normal },
          ]}
        />
      )}

      <VersionLogDialog
        open={!!historyRow}
        onOpenChange={(o) => { if (!o) setHistoryRow(null) }}
        doctype="Shift Type"
        name={historyRow?.name ?? null}
      />
    </div>
  )
}
