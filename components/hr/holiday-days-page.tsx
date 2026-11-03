'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { fmtDate } from '@/lib/hr-format'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { cn } from '@/lib/utils'

const FIELD = 'h-[42px] w-full rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

interface HolidayRow { name: string; holiday_date: string | null; description: string; weekly_off: boolean }

function today() { return new Date().toISOString().slice(0, 10) }

/**
 * «العطلات الرسمية → أيام العطلة» (Apex M4) — individual holiday dates under
 * one Holiday List (`?list=<name>`): add a date range in one go, edit a row's
 * description, delete a row, print. Backed by base_meena.api.hr_holidays.
 */
export function HolidayDaysPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const list = searchParams.get('list') || ''

  const [rows, setRows] = useState<HolidayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addFrom, setAddFrom] = useState(today())
  const [addTo, setAddTo] = useState(today())
  const [addDesc, setAddDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [editRow, setEditRow] = useState<HolidayRow | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [deleteRow, setDeleteRow] = useState<HolidayRow | null>(null)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    if (!list) { setLoading(false); return }
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_holidays.get_holidays', { list })
      setRows(r?.message?.holidays ?? [])
    } catch (e: any) {
      toast({ title: 'فشل تحميل العطلات', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [list, toast])
  useEffect(() => { load() }, [load])

  const addHolidays = async () => {
    if (!addFrom || !addTo) {
      toast({ title: 'التاريخ من وإلى مطلوبان', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_holidays.add_holidays', { list, from: addFrom, to: addTo, description: addDesc })
      toast({ title: 'تم الحفظ' })
      setAddOpen(false)
      setAddDesc('')
      load()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!editRow) return
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_holidays.update_holiday', { list, row: editRow.name, description: editDesc })
      toast({ title: 'تم الحفظ' })
      setEditRow(null)
      load()
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteRow) return
    setWorking(true)
    try {
      await frappeClient.call('base_meena.api.hr_holidays.delete_holiday', { list, row: deleteRow.name })
      toast({ title: 'تم الحفظ' })
      setDeleteRow(null)
      load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  if (!list) {
    return (
      <div className="px-4 pt-6" dir="rtl">
        <EmptyState title="لم يتم تحديد قائمة عطلات" description="افتح هذه الصفحة من قائمة العطلات الرسمية" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-8" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[14px] text-slate-700">
          <span className="text-slate-600">البيانات الاساسية</span><span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-600">العطلات الرسمية</span><span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-800 font-bold">{list}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="h-[40px] px-4 rounded border border-[var(--apex-border)] bg-white text-[14px] text-slate-700 flex items-center gap-1.5 hover:bg-slate-50">
            <Printer className="h-4 w-4" />طباعة
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className="h-[40px] px-4 rounded bg-[var(--apex-blue)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-blue-hover)]">
            <Plus className="h-4 w-4" />اضافة عطلة
          </button>
        </div>
      </div>

      <div className="bg-white rounded-sm shadow-sm">
        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-7 w-7 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد عطلات مضافة" description="اضغط «اضافة عطلة» لإضافة تواريخ" />
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-[var(--apex-thead)] text-slate-800">
                <th className="py-3 px-3 text-right">التاريخ</th>
                <th className="py-3 px-3 text-right">الوصف</th>
                <th className="py-3 px-3 text-right">عطلة أسبوعية</th>
                <th className="py-3 px-3 text-right print:hidden">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-slate-200">
                  <td className="py-2.5 px-3">{fmtDate(r.holiday_date)}</td>
                  <td className="py-2.5 px-3">{r.description || '—'}</td>
                  <td className="py-2.5 px-3">{r.weekly_off ? 'نعم' : 'لا'}</td>
                  <td className="py-2.5 px-3 print:hidden">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setEditRow(r); setEditDesc(r.description || '') }} className="text-[var(--apex-blue)]" aria-label="تعديل">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setDeleteRow(r)} className="text-red-600" aria-label="حذف">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* add a date range */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>اضافة عطلة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[13px] text-slate-700 mb-1">من تاريخ <span className="text-red-500">*</span></span>
                <input type="date" value={addFrom} onChange={(e) => setAddFrom(e.target.value)} className={FIELD} />
              </div>
              <div>
                <span className="block text-[13px] text-slate-700 mb-1">إلى تاريخ <span className="text-red-500">*</span></span>
                <input type="date" value={addTo} onChange={(e) => setAddTo(e.target.value)} className={FIELD} />
              </div>
            </div>
            <div>
              <span className="block text-[13px] text-slate-700 mb-1">الوصف</span>
              <input value={addDesc} onChange={(e) => setAddDesc(e.target.value)} className={FIELD} />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={addHolidays} disabled={saving} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit description */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تعديل العطلة — {fmtDate(editRow?.holiday_date)}</DialogTitle></DialogHeader>
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">الوصف</span>
            <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={cn(FIELD)} />
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={saveEdit} disabled={saving} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(o) => !o && setDeleteRow(null)}
        title="حذف العطلة"
        description={`هل تريد حذف العطلة بتاريخ ${fmtDate(deleteRow?.holiday_date)}؟`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
