'use client'

/**
 * «الدوام المتغير» groups list for ONE parent shift (owner's spec §1/§2,
 * `/shift-management/<id>/groups`) — replaces the old standalone
 * `/rotational-shifts` list now that a rotational group always belongs to a
 * specific «أوقات العمل» shift. Same Apex toolbar/table/pagination
 * primitives as shift-list-page.tsx; columns are deliberately narrower than
 * the old list (no work/rest/shift-count/employee-count — spec §2 drops
 * them from this screen). Backed by base_meena.api.hr_rotational_shifts's
 * list_shift_groups / get_group_meta / get_group_view / save_group_meta /
 * delete_shift_group.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/hr-format'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { ApexEmptyState, BoxIllustration } from '@/components/hr/apex-empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RowMenu } from '@/components/hr/apex/row-menu'
import { ViewRecordDialog } from '@/components/hr/apex/view-record-dialog'
import { VersionLogDialog } from '@/components/hr/apex/version-log-dialog'
import { EMPTY_GROUP_META, type RotationalGroupListRow, type RotationalGroupMeta } from '@/components/hr/rotational/types'

const PAGE_SIZES = [5, 10, 20, 50]
const FIELD = 'w-full h-[44px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

export function RotationalGroupsPage({ parentShift }: { parentShift: string }) {
  const router = useRouter()
  const { toast } = useToast()

  const [shiftName, setShiftName] = useState('')
  const [rows, setRows] = useState<RotationalGroupListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<RotationalGroupMeta>(EMPTY_GROUP_META)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RotationalGroupListRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [viewRow, setViewRow] = useState<RotationalGroupListRow | null>(null)
  const [viewFields, setViewFields] = useState<{ label: string; value: string }[] | null>(null)
  const [historyRow, setHistoryRow] = useState<RotationalGroupListRow | null>(null)

  useEffect(() => {
    frappeClient.call('base_meena.api.hr_shifts.get_shift', { name: parentShift })
      .then((r: any) => setShiftName(r?.message?.arabic_name || parentShift))
      .catch(() => setShiftName(parentShift))
  }, [parentShift])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.list_shift_groups', { parent_shift: parentShift })
      setRows(Array.isArray(res?.message) ? res.message : [])
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل مجموعات الدوام', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [parentShift, toast])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => (r.group_name || '').toLowerCase().includes(q))
  }, [rows, search])

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

  const goEdit = (row: RotationalGroupListRow) =>
    router.push(`/shift-management/${encodeURIComponent(parentShift)}/groups/${encodeURIComponent(row.name)}`)

  const openAdd = () => { setForm(EMPTY_GROUP_META); setDialogMode('add') }
  const openEdit = (row: RotationalGroupListRow) => {
    setForm({ name: row.name, group_name: row.group_name, group_name_en: row.group_name_en || '', start_date: row.start_date ? String(row.start_date).slice(0, 10) : '' })
    setDialogMode('edit')
  }

  const saveMeta = async () => {
    if (!form.group_name.trim()) {
      toast({ title: 'حقول مطلوبة', description: 'إسم مجموعة الدوام بالعربية مطلوب', variant: 'destructive' })
      return
    }
    if (!form.start_date) {
      toast({ title: 'حقول مطلوبة', description: 'تاريخ بدء العمل بالدوام مطلوب', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.save_group_meta', {
        parent_shift: parentShift,
        name: form.name,
        group_name: form.group_name.trim(),
        group_name_en: form.group_name_en || '',
        start_date: form.start_date,
      })
      const isAdd = dialogMode === 'add'
      setDialogMode(null)
      if (isAdd) {
        const newName = res?.message?.name
        toast({ title: 'تم إضافة المجموعة' })
        if (newName) {
          router.push(`/shift-management/${encodeURIComponent(parentShift)}/groups/${encodeURIComponent(newName)}`)
          return
        }
        await load()
      } else {
        toast({ title: 'تم تعديل المجموعة' })
        await load()
      }
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const openView = async (row: RotationalGroupListRow) => {
    setViewRow(row)
    setViewFields([
      { label: 'الاسم باللغة العربية', value: row.group_name || '—' },
      { label: 'تاريخ البداية', value: row.start_date ? fmtDate(row.start_date) : '—' },
    ])
    try {
      const res: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.get_group_view', { name: row.name })
      const data = res?.message
      if (data) {
        setViewFields([
          { label: 'الاسم باللغة العربية', value: data.group_name || '—' },
          { label: 'تاريخ البداية', value: data.start_date ? fmtDate(data.start_date) : '—' },
        ])
      }
    } catch {
      // keep the row-derived fallback already set above
    }
  }

  const deleteOne = async (name: string) => {
    await frappeClient.call('base_meena.api.hr_rotational_shifts.delete_shift_group', { name })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteOne(deleteTarget.name)
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast({ title: 'تعذّر الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    let ok = 0, failed = 0
    for (const name of selected) {
      try { await deleteOne(name); ok++ } catch { failed++ }
    }
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelected(new Set())
    toast({
      title: `تم حذف ${ok}`,
      description: failed ? `تعذّر حذف ${failed} — تأكد من عدم وجود موظفين على هذه المجموعات` : undefined,
      variant: failed ? 'destructive' : undefined,
    })
    await load()
  }

  return (
    <div className="px-4 pt-2 pb-8" dir="rtl">
      {/* breadcrumb — «البيانات الاساسية / أوقات العمل / <shift name>» */}
      <div className="text-[14px] mb-4">
        <span className="text-slate-600">البيانات الاساسية</span>
        <span className="mx-2 text-slate-400">/</span>
        <button type="button" onClick={() => router.push('/shift-management')} className="text-[var(--apex-link)] hover:underline">
          أوقات العمل
        </button>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-bold">{shiftName || '…'}</span>
      </div>

      <ApexToolbar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: 'إبحث بإسم الدوام' }}
        actions={{
          disabled: selected.size === 0,
          items: [{ label: 'حذف', onSelect: () => setBulkDeleteOpen(true) }],
        }}
        add={{ label: 'إضافة مجموعة دوام', onClick: openAdd }}
      />

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
      ) : filtered.length === 0 ? (
        rows.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-10">
            <BoxIllustration />
            <p className="text-[18px] font-bold text-slate-800">لا توجد مجموعات دوام بعد</p>
            <button type="button" onClick={openAdd} className="h-[42px] px-5 rounded bg-[var(--apex-green)] text-white text-[15px] flex items-center gap-2 hover:bg-[var(--apex-green-dark)]">
              إضافة مجموعة دوام +
            </button>
          </div>
        ) : (
          <ApexEmptyState />
        )
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
                  <th className="px-3 py-2 text-[14px] font-bold text-[var(--apex-text)] border-b border-slate-200">إسم مجموعة الدوام</th>
                  <th className="px-3 py-2 text-[14px] font-bold text-[var(--apex-text)] border-b border-slate-200">تاريخ بدء العمل بالدوام</th>
                  <th className="px-3 py-2 text-[14px] font-bold text-[var(--apex-text)] border-b border-slate-200 text-center">الاجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.name}>
                    <td className="border-b border-slate-100 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.name)}
                        onChange={() => toggleOne(row.name)}
                        className="h-4 w-4 cursor-pointer align-middle accent-[var(--apex-blue-light)]"
                        aria-label={`تحديد ${row.group_name}`}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-[14px] border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => goEdit(row)}
                        className="hover:underline"
                        style={{ color: 'rgb(0, 123, 255)', fontSize: '14px', fontWeight: 400 }}
                      >
                        {row.group_name || '—'}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-[14px] text-[var(--apex-text)] border-b border-slate-100">
                      {row.start_date ? fmtDate(row.start_date) : '—'}
                    </td>
                    <td className="apex-col-actions px-3 py-1.5 border-b border-slate-100">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openEdit(row)} title="تعديل" aria-label={`تعديل ${row.group_name}`} className="apex-icon-edit px-1 hover:opacity-75">
                          <Pencil className="h-[17px] w-[17px]" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(row)} title="حذف" aria-label={`حذف ${row.group_name}`} className="apex-icon-delete px-1 hover:opacity-75">
                          <Trash2 className="h-[17px] w-[17px]" />
                        </button>
                        <RowMenu
                          kind="master"
                          onView={() => openView(row)}
                          onHistory={() => setHistoryRow(row)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
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
        title={dialogMode === 'add' ? 'إضافة مجموعة دوام' : 'تعديل مجموعة دوام'}
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
            <span className="block text-[13px] text-slate-700 mb-1">اسم مجموعة الدوام بالعربية<span className="text-red-500"> *</span></span>
            <input
              value={form.group_name}
              onChange={(e) => setForm((p) => ({ ...p, group_name: e.target.value }))}
              placeholder="اسم مجموعة الدوام بالعربية"
              className={FIELD}
            />
          </div>
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">اسم مجموعة الدوام بالانجليزية</span>
            <input
              value={form.group_name_en}
              onChange={(e) => setForm((p) => ({ ...p, group_name_en: e.target.value }))}
              placeholder="اسم مجموعة الدوام بالانجليزية"
              className={FIELD}
            />
          </div>
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">تاريخ بدء العمل بالدوام<span className="text-red-500"> *</span></span>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              aria-label="تاريخ بدء العمل بالدوام"
              className={FIELD}
            />
          </div>
        </div>
      </ApexDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="هل تريد حذف مجموعة الدوام؟"
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="حذف المجموعات المحددة"
        description={`سيتم حذف ${selected.size} مجموعة نهائياً.`}
        confirmLabel={bulkDeleting ? 'جاري الحذف…' : 'حذف'}
        cancelLabel="إلغاء"
        variant="destructive"
        loading={bulkDeleting}
        onConfirm={confirmBulkDelete}
      />

      {viewRow && viewFields && (
        <ViewRecordDialog
          open={!!viewRow}
          onOpenChange={(o) => { if (!o) { setViewRow(null); setViewFields(null) } }}
          title="مجموعة الدوام"
          fields={viewFields}
        />
      )}

      <VersionLogDialog
        open={!!historyRow}
        onOpenChange={(o) => { if (!o) setHistoryRow(null) }}
        doctype="Shift Schedule"
        name={historyRow?.name ?? null}
      />
    </div>
  )
}
