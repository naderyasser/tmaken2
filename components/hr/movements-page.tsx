'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ReportPage } from '@/components/hr/report-page'
import { ApexDatePicker } from '@/components/hr/apex/date-picker'
import type { ReportConfig } from '@/lib/hr-reports'

const MOVEMENTS: ReportConfig = { slug: 'movements', report: 'movements', title: 'اضافة و تعديل حركات', dates: true }

interface Emp { name: string; employee_name: string; employee_number?: string }

/**
 * «اضافة و تعديل حركات» — Apex layout: the report filter grid over the raw
 * movements (one row per checkin) plus a green «اضافة» that records a manual
 * Employee Checkin.
 */
export function MovementsPage() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [emps, setEmps] = useState<Emp[]>([])
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [form, setForm] = useState({ employee: '', date: new Date().toISOString().slice(0, 10), time: '08:00', log_type: 'IN' })

  useEffect(() => {
    if (!open || emps.length) return
    frappeClient.getList<Emp>('Employee', {
      fields: ['name', 'employee_name', 'employee_number'],
      filters: [['status', '=', 'Active']], order_by: 'employee_name asc', limit_page_length: 0,
    }).then(setEmps).catch(() => setEmps([]))
  }, [open, emps.length])

  const save = async () => {
    if (!form.employee) { toast({ title: 'اختر الموظف', variant: 'destructive' }); return }
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_reports.add_movement', {
        employee: form.employee, date: form.date, time: form.time, log_type: form.log_type,
      })
      toast({ title: 'تمت إضافة الحركة' })
      setOpen(false)
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      toast({ title: 'تعذّر الحفظ', description: e?.message, variant: 'destructive' })
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
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-[38px] px-4 rounded bg-[var(--apex-green)] text-white text-[14px] flex items-center gap-1.5 hover:bg-[var(--apex-green-dark)]"
          >
            <Plus className="h-4 w-4" />
            اضافة
          </button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>اضافة حركة</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>الموظف</Label>
              <select
                value={form.employee}
                onChange={(e) => setForm((f) => ({ ...f, employee: e.target.value }))}
                className="w-full h-10 rounded border border-[var(--apex-border)] bg-white px-3 text-[14px]"
              >
                <option value="">اختر الموظف</option>
                {emps.map((e) => <option key={e.name} value={e.name}>{e.employee_number || e.name} — {e.employee_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ApexDatePicker label="التاريخ" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
              <div className="space-y-1.5">
                <Label>الوقت</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>نوع الحركة</Label>
              <select
                value={form.log_type}
                onChange={(e) => setForm((f) => ({ ...f, log_type: e.target.value }))}
                className="w-full h-10 rounded border border-[var(--apex-border)] bg-white px-3 text-[14px]"
              >
                <option value="IN">حضور</option>
                <option value="OUT">إنصراف</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={save} disabled={saving} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)]">
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}حفظ
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>اغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
