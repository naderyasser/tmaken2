'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, RotateCcw, AlertCircle } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface AttendanceRow {
  name: string
  employee?: string
  employee_name?: string
  attendance_date?: string
  status?: string
  docstatus?: number
}

/**
 * «إلغاء ترحيل الحركات» — lists submitted Attendance records (docstatus = 1) and
 * lets a manager cancel (unpost) one via frappe.client.cancel.
 */
export function CancelTransactionsPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<AttendanceRow | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await frappeClient.getList<AttendanceRow>('Attendance', {
        fields: ['name', 'employee', 'employee_name', 'attendance_date', 'status', 'docstatus'],
        filters: [['docstatus', '=', 1]],
        order_by: 'attendance_date desc',
        limit_page_length: 100,
      })
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load Attendance:', e)
      setRows([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [r.name, r.employee, r.employee_name, r.attendance_date]
      .some((v) => String(v ?? '').toLowerCase().includes(q))
  })

  const confirmCancel = async () => {
    if (!target) return
    setCancelling(true)
    try {
      await frappeClient.call('frappe.client.cancel', { doctype: 'Attendance', name: target.name })
      toast({ title: 'تم إلغاء الترحيل' })
      setTarget(null)
      await load()
    } catch (e) {
      toast({
        title: 'فشل إلغاء الترحيل',
        description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم',
        variant: 'destructive',
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div dir="rtl" className="space-y-4 p-6 font-[family-name:var(--font-arabic)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">إلغاء ترحيل الحركات</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">إلغاء ترحيل حركات الحضور المرحّلة</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} title="تحديث" className="text-[#195a9e] hover:bg-blue-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-4">
          <Input
            placeholder="إبحث بإسم الموظف أو التاريخ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-sm border-slate-300 text-right placeholder:text-slate-400"
          />
        </div>

        {loadError && !loading && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>تعذّر تحميل الحركات من الخادم.</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-right">
            <thead>
              <tr className="bg-[#cbd5e1] text-slate-700 border-y border-slate-300 h-10">
                <th className="px-4 font-bold">الكود</th>
                <th className="px-4 font-bold">الموظف</th>
                <th className="px-4 font-bold">التاريخ</th>
                <th className="px-4 font-bold">الحالة</th>
                <th className="px-4 font-bold w-32 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#195a9e] mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-500">لا توجد بيانات</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.name} className="border-b border-slate-100 hover:bg-slate-50 h-12">
                    <td className="px-4 text-slate-700">{r.name}</td>
                    <td className="px-4 text-slate-700">{r.employee_name || r.employee || '—'}</td>
                    <td className="px-4 text-slate-700">{r.attendance_date || '—'}</td>
                    <td className="px-4 text-slate-700">{r.status || '—'}</td>
                    <td className="px-4 text-center">
                      <button
                        onClick={() => setTarget(r)}
                        className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 font-bold"
                      >
                        <RotateCcw className="h-4 w-4" />
                        إلغاء الترحيل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => { if (!o) setTarget(null) }}
        title="إلغاء ترحيل الحركة"
        description={target ? `سيتم إلغاء ترحيل الحركة "${target.name}". هل أنت متأكد؟` : ''}
        confirmLabel="إلغاء الترحيل"
        cancelLabel="رجوع"
        loading={cancelling}
        onConfirm={confirmCancel}
      />
    </div>
  )
}
