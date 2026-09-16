'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

interface Emp { name: string; employee_name: string; employee_number?: string; branch?: string }
interface AttendanceRow { name: string; employee: string; employee_name?: string; attendance_date: string; status?: string }

function today() { return new Date().toISOString().slice(0, 10) }

const FIELD = 'h-[42px] rounded border border-[#ced4da] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[#2960b6]'

/**
 * «إلغاء ترحيل الحركات» — Apex layout: من تاريخ | إلى تاريخ | [+ تحديد الموظفين]
 * | [إلغاء ترحيل الحركات]. Cancels every submitted Attendance record of the
 * chosen employees inside the range (frappe.client.cancel), i.e. un-posts the
 * movements so they can be re-processed.
 */
export function CancelTransactionsPage() {
  const { toast } = useToast()
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [emps, setEmps] = useState<Emp[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState<AttendanceRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    frappeClient.getList<Emp>('Employee', {
      fields: ['name', 'employee_name', 'employee_number', 'branch'],
      filters: [['status', '=', 'Active']], order_by: 'employee_name asc', limit_page_length: 0,
    }).then(setEmps).catch(() => setEmps([]))
  }, [])

  const filteredEmps = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return emps
    return emps.filter((e) => [e.name, e.employee_name, e.employee_number].some((v) => String(v ?? '').toLowerCase().includes(s)))
  }, [emps, q])

  const loadPreview = useCallback(async () => {
    if (!selected.size) { setPreview(null); return }
    setLoading(true)
    try {
      const rows = await frappeClient.getList<AttendanceRow>('Attendance', {
        fields: ['name', 'employee', 'employee_name', 'attendance_date', 'status'],
        filters: [['docstatus', '=', 1], ['employee', 'in', [...selected]], ['attendance_date', 'between', [from, to]]],
        order_by: 'attendance_date asc', limit_page_length: 0,
      })
      setPreview(rows)
    } catch {
      setPreview([])
    } finally {
      setLoading(false)
    }
  }, [selected, from, to])

  useEffect(() => { loadPreview() }, [loadPreview])

  const run = async () => {
    if (!preview?.length) return
    setWorking(true)
    let ok = 0, failed = 0
    for (const r of preview) {
      try {
        await frappeClient.call('frappe.client.cancel', { doctype: 'Attendance', name: r.name })
        ok++
      } catch {
        failed++
      }
    }
    setWorking(false)
    setConfirm(false)
    toast({ title: `تم إلغاء ترحيل ${ok} حركة`, description: failed ? `تعذّر إلغاء ${failed}` : undefined, variant: failed ? 'destructive' : undefined })
    loadPreview()
  }

  const toggle = (name: string) =>
    setSelected((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n })

  return (
    <div className="px-4 pt-2 pb-8" dir="rtl">
      <div className="text-[14px] text-slate-700 mb-4">
        <span className="text-slate-600">الاجراءات</span><span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800">إلغاء ترحيل الحركات</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
        <div>
          <span className="block text-[13px] text-slate-700 mb-1">من تاريخ <span className="text-red-500">*</span></span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(FIELD, 'w-full')} />
        </div>
        <div>
          <span className="block text-[13px] text-slate-700 mb-1">إلى تاريخ <span className="text-red-500">*</span></span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cn(FIELD, 'w-full')} />
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="h-[58px] px-5 rounded bg-[#2960b6] text-white text-[15px] flex items-center gap-2 hover:bg-[#2455a3]"
        >
          <Plus className="h-4 w-4" />
          <span className="text-center leading-tight">تحديد<br />الموظفين{selected.size ? ` (${selected.size})` : ''}</span>
        </button>
        <button
          type="button"
          disabled={!preview?.length || working}
          onClick={() => setConfirm(true)}
          className="h-[42px] px-5 rounded text-white text-[15px] bg-[#e9a3a3] disabled:opacity-90 enabled:bg-[#dc3545] enabled:hover:bg-[#c82333]"
        >
          إلغاء ترحيل الحركات
        </button>
      </div>

      {/* what will be cancelled */}
      {preview && (
        <div className="mt-6 bg-white rounded-sm shadow-sm">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2960b6]" /></div>
          ) : preview.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-[14px]">لا توجد حركات مرحّلة للموظفين المحددين في هذه الفترة</div>
          ) : (
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-[#c8d3e5] text-slate-800">
                  <th className="py-3 px-3 text-right">الكود</th>
                  <th className="py-3 px-3 text-right">الموظف</th>
                  <th className="py-3 px-3 text-right">التاريخ</th>
                  <th className="py-3 px-3 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.name} className="border-b border-slate-200">
                    <td className="py-2.5 px-3">{r.employee}</td>
                    <td className="py-2.5 px-3">{r.employee_name || r.employee}</td>
                    <td className="py-2.5 px-3">{r.attendance_date}</td>
                    <td className="py-2.5 px-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* employee picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>تحديد الموظفين</DialogTitle></DialogHeader>
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالكود او اسم الموظف" className={cn(FIELD, 'w-full pr-9')} />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-center justify-between text-[13px] text-slate-600 px-1">
            <button type="button" className="text-[#2960b6]" onClick={() => setSelected(new Set(filteredEmps.map((e) => e.name)))}>تحديد الكل</button>
            <button type="button" className="text-red-600 flex items-center gap-1" onClick={() => setSelected(new Set())}><X className="h-3.5 w-3.5" />إلغاء التحديد</button>
          </div>
          <div className="max-h-80 overflow-y-auto border rounded">
            {filteredEmps.map((e) => (
              <label key={e.name} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-slate-50 cursor-pointer text-[14px]">
                <input type="checkbox" checked={selected.has(e.name)} onChange={() => toggle(e.name)} className="h-4 w-4" />
                <span className="text-slate-500 w-28 shrink-0">{e.employee_number || e.name}</span>
                <span className="flex-1">{e.employee_name}</span>
                <span className="text-slate-400 text-[12px]">{e.branch}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={() => setPickerOpen(false)} className="bg-[#2960b6] hover:bg-[#2455a3]">تم ({selected.size})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="إلغاء ترحيل الحركات"
        description={`سيتم إلغاء ترحيل ${preview?.length ?? 0} حركة حضور من ${from} إلى ${to}. هل أنت متأكد؟`}
        confirmLabel="إلغاء الترحيل"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={run}
      />
    </div>
  )
}
