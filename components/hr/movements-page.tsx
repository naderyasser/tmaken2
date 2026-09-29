'use client'

import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/hr-format'
import { arabizeError } from '@/lib/frappe-error'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ReportPage } from '@/components/hr/report-page'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDatePicker, ApexTimePicker } from '@/components/hr/apex/date-picker'
import { ViewRecordDialog } from '@/components/hr/apex/view-record-dialog'
import { VersionLogDialog } from '@/components/hr/apex/version-log-dialog'
import { FieldInput } from '@/components/hr/field-input'
import type { ReportConfig } from '@/lib/hr-reports'

const MOVEMENTS: ReportConfig = { slug: 'movements', report: 'movements', title: 'اضافة و تعديل حركات', dates: true }
const M = 'base_meena.api.hr_reports'
const FIELD = 'h-[42px] w-full rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'
const EMPLOYEE_FIELD = { field: 'employee', label: 'الموظف', type: 'link' as const, link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] as any } }

type Row = Record<string, any>
type Form = { employee: string; date: string; time: string; log_type: string; device: string; password: string }
const today = () => new Date().toISOString().slice(0, 10)

function printMovement(r: Row) {
  const w = window.open('', '_blank', 'width=720,height=560')
  if (!w) return
  const cell = (k: string, v: unknown) => `<tr><th>${k}</th><td>${String(v ?? '—').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))}</td></tr>`
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>حركة</title><style>
    body{font-family:'Noto Kufi Arabic',Tahoma,sans-serif;padding:32px;color:#212529}h1{font-size:18px;text-align:center;margin:0 0 20px}
    table{width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid #ced4da;padding:8px 12px;text-align:right}th{background:#bcc2d1;width:35%}
  </style></head><body><h1>حركة موظف</h1><table>
    ${cell('رقم', r.code)}${cell('اسم الموظف', r.name)}${cell('التاريخ', fmtDate(r.date))}${cell('الوقت', r.time)}
    ${cell('الحركة', r.type)}${cell('الجهاز', r.device)}${cell('معدل', r.edited)}
  </table></body></html>`)
  w.document.close(); w.focus(); w.print()
}

/**
 * «اضافة و تعديل حركات» — Apex (app-add-modify-movements): the report filter
 * card, then a flat list رقم · اسم الموظف · التاريخ · الوقت · معدل with ✎ · 🗑 ·
 * ⋮ (عرض · PDF · طباعة · سجل الحركات). ✎ asks for «كلمة مرور المسؤول».
 */
export function MovementsPage() {
  const { toast } = useToast()
  const [reloadKey, setReloadKey] = useState(0)
  const [devices, setDevices] = useState<{ name: string; device_name: string }[]>([])
  const [editing, setEditing] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Form>({ employee: '', date: today(), time: '', log_type: 'IN', device: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [viewRow, setViewRow] = useState<Row | null>(null)
  const [historyRow, setHistoryRow] = useState<Row | null>(null)

  useEffect(() => {
    frappeClient.getList<{ name: string; device_name: string }>('Biometric Device', { fields: ['name', 'device_name'], limit_page_length: 0 })
      .then(setDevices).catch(() => setDevices([]))
  }, [])

  const openAdd = () => {
    setEditing(null); setShowPwd(false)
    setForm({ employee: '', date: today(), time: '', log_type: 'IN', device: '', password: '' })
    setOpen(true)
  }
  const openEdit = (r: Row) => {
    setEditing(r); setShowPwd(false)
    setForm({ employee: r.employee, date: r.date, time: r.time, log_type: r.log_type || 'IN', device: r.device_serial || '', password: '' })
    setOpen(true)
  }

  const save = async () => {
    if (!form.employee || !form.date || !/^\d{2}:\d{2}$/.test(form.time)) {
      toast({ title: 'أكمل الحقول المطلوبة', description: 'الموظف والتاريخ والوقت (HH:mm)', variant: 'destructive' }); return
    }
    if (!form.password) { toast({ title: 'أدخل كلمة مرور المسؤول', variant: 'destructive' }); return }
    setSaving(true)
    try {
      if (editing) {
        await frappeClient.call(`${M}.update_movement`, { name: editing.id, ...form })
      } else {
        // Apex: no type field — the server derives IN/OUT from the day's punch order
        await frappeClient.call(`${M}.add_movement`, { employee: form.employee, date: form.date, time: form.time, device: form.device, password: form.password })
      }
      toast({ title: editing ? 'تم التعديل' : 'تمت إضافة الحركة' })
      setOpen(false); setReloadKey((k) => k + 1)
    } catch (e: any) {
      toast({ title: 'تعذّر الحفظ', description: arabizeError(e?.message), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await frappeClient.call(`${M}.delete_movement`, { name: deleteTarget.id })
      toast({ title: 'تم الحذف' }); setDeleteTarget(null); setReloadKey((k) => k + 1)
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: arabizeError(e?.message), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ReportPage
        config={MOVEMENTS}
        breadcrumb={['الحضور و الانصراف', 'الاجراءات']}
        defaultFrom="month"
        reloadKey={reloadKey}
        addSlot={
          <button type="button" onClick={openAdd}
            className="h-[38px] px-4 rounded bg-[var(--apex-green)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-green-dark)]">
            اضافة <Plus className="h-4 w-4" />
          </button>
        }
        renderBody={(rows) => (
          <MovementsTable rows={rows} onEdit={openEdit} onDelete={setDeleteTarget} onView={setViewRow} onHistory={setHistoryRow} />
        )}
      />

      <ApexDialog open={open} onOpenChange={setOpen} title={editing ? 'تعديل حركة' : 'اضافة حركة'} size="lg"
        primary={{ label: editing ? 'تعديل' : 'اضافة', onClick: save, loading: saving }}>
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">الموظف <span className="text-red-500">*</span></label>
          <FieldInput field={EMPLOYEE_FIELD} value={form.employee} onChange={(v) => setForm((f) => ({ ...f, employee: v }))} />
        </div>
        <ApexDatePicker label="التاريخ" required value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
        <ApexTimePicker label="الوقت" required value={form.time} onChange={(v) => setForm((f) => ({ ...f, time: v }))} />
        <div>
          <label className="block text-[13px] text-slate-700 mb-1">الجهاز</label>
          <select value={form.device} onChange={(e) => setForm((f) => ({ ...f, device: e.target.value }))} className={FIELD}>
            <option value="">يدوي</option>
            {devices.map((d) => <option key={d.name} value={d.name}>{d.device_name || d.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[13px] text-slate-700 mb-1">كلمة مرور المسؤول <span className="text-red-500">*</span></label>
          <div className="relative">
            <input type={showPwd ? 'text' : 'password'} value={form.password} autoComplete="current-password"
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={`${FIELD} ps-10`} />
            <button type="button" onClick={() => setShowPwd((s) => !s)} aria-label={showPwd ? 'اخفاء كلمة المرور' : 'اظهار كلمة المرور'}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700">
              {showPwd ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>
      </ApexDialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="حذف الحركة؟" description={deleteTarget ? `${deleteTarget.name} — ${fmtDate(deleteTarget.date)} ${deleteTarget.time}` : undefined}
        confirmLabel="حذف" cancelLabel="إلغاء" onConfirm={remove} loading={saving} />

      <ViewRecordDialog open={!!viewRow} onOpenChange={(o) => { if (!o) setViewRow(null) }} title="عرض الحركة"
        fields={viewRow ? [
          { label: 'رقم', value: viewRow.code }, { label: 'اسم الموظف', value: viewRow.name },
          { label: 'التاريخ', value: fmtDate(viewRow.date) }, { label: 'الوقت', value: viewRow.time },
          { label: 'الحركة', value: viewRow.type }, { label: 'الجهاز', value: viewRow.device || '—' },
          { label: 'المصدر', value: viewRow.source }, { label: 'معدل', value: viewRow.edited },
        ] : []} />

      <VersionLogDialog open={!!historyRow} onOpenChange={(o) => { if (!o) setHistoryRow(null) }}
        doctype="Employee Checkin" name={historyRow?.id ?? null}
        labels={{ time: 'الوقت', employee: 'الموظف', device_id: 'الجهاز', log_type: 'الحركة' }} />
    </>
  )
}

function MovementsTable({ rows, onEdit, onDelete, onView, onHistory }: {
  rows: Row[]
  onEdit: (r: Row) => void
  onDelete: (r: Row) => void
  onView: (r: Row) => void
  onHistory: (r: Row) => void
}) {
  // Apex lists the newest movement first
  const sorted = useMemo(() => [...rows].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)), [rows])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages)
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize)

  return (
    <>
      <div className="overflow-x-auto rounded-sm shadow-sm">
        <table className="apex-table w-full text-[14px]">
          <thead>
            <tr>
              <th className="text-right">رقم</th>
              <th className="text-right">اسم الموظف</th>
              <th className="text-center">التاريخ</th>
              <th className="text-center">الوقت</th>
              <th className="text-center">معدل</th>
              <th className="text-center">الاجراءات</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-500">لا يوجد نتائج للبحث ابحث مرة اخري</td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td className="text-center" dir="ltr">{r.date}</td>
                <td className="text-center" dir="ltr">{r.time}</td>
                <td className="text-center">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${r.edited === 'نعم' ? 'bg-[var(--apex-green)]' : 'bg-[var(--apex-red)]'}`} />
                    {r.edited}
                  </span>
                </td>
                <td>
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" title="تعديل" onClick={() => onEdit(r)} className="apex-icon-edit px-1 hover:opacity-75"><Pencil className="h-[17px] w-[17px]" /></button>
                    <button type="button" title="حذف" onClick={() => onDelete(r)} className="apex-icon-delete px-1 hover:opacity-75"><Trash2 className="h-[17px] w-[17px]" /></button>
                    <DropdownMenu dir="rtl">
                      <DropdownMenuTrigger asChild>
                        <button type="button" title="خيارات" aria-label="خيارات" className="apex-icon-more px-1 rounded"><MoreVertical className="h-[18px] w-[18px]" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[150px] text-[13px]">
                        <DropdownMenuItem onClick={() => onView(r)}>عرض</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printMovement(r)}>PDF</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printMovement(r)}>طباعة</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onHistory(r)}>سجل الحركات</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ApexPagination page={current} pageCount={pages} pageSize={pageSize} total={sorted.length}
        onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1) }} />
    </>
  )
}
