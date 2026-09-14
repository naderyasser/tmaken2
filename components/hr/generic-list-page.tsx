'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, Plus, Pencil, Trash2, Loader2, RefreshCw,
  ChevronRight, ChevronLeft, AlertCircle,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
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

type Row = Record<string, any> & { name: string }

const PAGE_SIZES = [10, 20, 50]

/**
 * Generic master-data list screen: search + table + add/edit/delete, driven by a
 * ListModuleConfig. Mirrors the Apex ERP list styling (white card, slate header,
 * right-aligned RTL controls).
 */
export function GenericListPage({ config }: { config: ListModuleConfig }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)

  const tableFields = useMemo(
    () => config.fields.filter((f) => f.inTable !== false),
    [config.fields],
  )
  const formFields = useMemo(
    () => config.fields.filter((f) => f.inForm !== false),
    [config.fields],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const fieldNames = Array.from(new Set([...config.fields.map((f) => f.field), 'name']))
      const data = await frappeClient.getList<Row>(config.doctype, {
        fields: fieldNames,
        filters: config.filters,
        order_by: config.orderBy,
        limit_page_length: 0,
      })
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      // The backend may be unreachable or the doctype may not exist on this tenant.
      // Keep the screen usable (empty table + notice) instead of throwing.
      console.error(`Failed to load ${config.doctype}:`, e)
      setRows([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [config.doctype, config.fields, config.filters, config.orderBy])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      tableFields.some((f) => String(r[f.field] ?? '').toLowerCase().includes(q)),
    )
  }, [rows, search, tableFields])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openAdd = () => {
    const initial: Record<string, any> = {}
    for (const f of formFields) initial[f.field] = f.type === 'checkbox' ? false : ''
    setEditing(null)
    setForm(initial)
    setDialogOpen(true)
  }

  const openEdit = (row: Row) => {
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
      if (editing) {
        await frappeClient.put(config.doctype, editing.name, payload)
      } else {
        await frappeClient.post(config.doctype, payload)
      }
      toast({ title: editing ? 'تم التحديث' : 'تمت الإضافة' })
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast({
        title: 'فشل الحفظ',
        description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
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
      toast({
        title: 'فشل الحذف',
        description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const colCount = tableFields.length + (config.readOnly ? 0 : 1)

  return (
    <div dir="rtl" className="space-y-4 p-6 font-[family-name:var(--font-arabic)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{config.title}</h1>
          {config.subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{config.subtitle}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={load}
          title="تحديث"
          className="text-[#195a9e] hover:bg-blue-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-slate-200/60 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 bg-white">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#195a9e]" />
            <Input
              placeholder={config.searchPlaceholder || 'إبحث…'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pr-9 h-9 rounded-sm border-slate-300 focus-visible:ring-blue-500 w-full text-right placeholder:text-slate-400"
            />
          </div>
          {!config.readOnly && (
            <Button
              onClick={openAdd}
              className="bg-[#2eb872] hover:bg-[#289e63] text-white px-5 rounded-sm font-bold text-[13px] h-9 shrink-0"
            >
              {config.addLabel || 'إضافة'}
              <Plus className="h-4 w-4 mr-2" strokeWidth={3} />
            </Button>
          )}
        </div>

        {/* Notice when the backend can't be reached */}
        {loadError && !loading && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>تعذّر تحميل البيانات من الخادم. تأكد من الاتصال والإعدادات ثم أعد المحاولة.</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-right">
            <thead>
              <tr className="bg-[#cbd5e1] text-slate-700 border-y border-slate-300 h-10">
                {tableFields.map((f) => (
                  <th key={f.field} className="px-4 font-bold whitespace-nowrap">{f.label}</th>
                ))}
                {!config.readOnly && <th className="px-4 font-bold w-28 text-center">الإجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Math.max(colCount, 1)} className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#195a9e] mx-auto" />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(colCount, 1)} className="py-12 text-center text-slate-500">
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.name} className="border-b border-slate-100 hover:bg-slate-50 h-12">
                    {tableFields.map((f) => (
                      <td key={f.field} className="px-4 text-slate-700">
                        {f.type === 'checkbox' ? (row[f.field] ? 'نعم' : 'لا') : (row[f.field] ?? '—')}
                      </td>
                    ))}
                    {!config.readOnly && (
                      <td className="px-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => openEdit(row)}
                            title="تعديل"
                            className="text-green-500 hover:text-green-600 transition-colors px-2"
                          >
                            <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
                          </button>
                          <div className="w-px h-5 bg-slate-300 mx-1" />
                          <button
                            onClick={() => setDeleteTarget(row)}
                            title="حذف"
                            className="text-red-500 hover:text-red-600 transition-colors px-2"
                          >
                            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 text-sm bg-white gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-700 text-[13px]">
            <span>عدد الصفوف</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger className="w-16 h-8 rounded-sm border-slate-300 bg-white font-bold text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 font-bold text-slate-700 text-[13px]">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 border border-slate-200 rounded-sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="px-2">صفحة {currentPage} من {totalPages}</span>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 border border-slate-200 rounded-sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `تعديل — ${config.title}` : config.addLabel || 'إضافة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {formFields.map((f) => (
              <div key={f.field} className="space-y-1.5">
                {f.type !== 'checkbox' && (
                  <Label className="text-[13px] text-slate-600">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </Label>
                )}
                <FieldInput
                  field={f}
                  value={form[f.field]}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.field]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={save} disabled={saving} className="bg-[#195a9e] hover:bg-[#154d8a] text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
    </div>
  )
}
