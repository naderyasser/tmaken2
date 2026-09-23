'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, UserX } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/hr-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'
import { EmployeeCombobox } from '@/components/hr/devices/employee-combobox'
import type { UnmappedEmployee } from '@/components/hr/devices/types'
import type { RotationalEmployeeRow } from './types'

/**
 * «الموظفون» — employees assigned to one rotational shift group. Backed by
 * base_meena.api.hr_rotational_shifts.get_group_employees /
 * get_available_employees / assign_employees / unassign. Only rendered once
 * the group has been saved (`groupId` set) — a brand-new, unsaved group has
 * nothing to assign employees to yet.
 */
export function EmployeesSection({ groupId }: { groupId?: string }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<RotationalEmployeeRow[]>([])
  const [loading, setLoading] = useState(!!groupId)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [addOpen, setAddOpen] = useState(false)
  const [available, setAvailable] = useState<UnmappedEmployee[]>([])
  const [pick, setPick] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RotationalEmployeeRow | null>(null)
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false)

  const load = useCallback(async () => {
    if (!groupId) { setRows([]); setLoading(false); return }
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.get_group_employees', { name: groupId })
      setRows(r?.message ?? [])
      setSelected(new Set())
    } catch (e: any) {
      toast({ title: 'فشل تحميل الموظفين', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [groupId, toast])
  useEffect(() => { load() }, [load])

  const openAdd = async () => {
    if (!groupId) return
    setPick('')
    setFromDate(new Date().toISOString().slice(0, 10))
    setAddOpen(true)
    setLoadingAvailable(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_rotational_shifts.get_available_employees', { name: groupId })
      setAvailable(r?.message ?? [])
    } catch (e: any) {
      toast({ title: 'فشل تحميل الموظفين', description: e?.message, variant: 'destructive' })
      setAvailable([])
    } finally {
      setLoadingAvailable(false)
    }
  }

  const addEmployee = async () => {
    if (!groupId || !pick) return
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_rotational_shifts.assign_employees', {
        name: groupId, employees: [pick], from_date: fromDate || undefined,
      })
      toast({ title: 'تمت الإضافة' })
      setAddOpen(false)
      await load()
    } catch (e: any) {
      toast({ title: 'فشلت الإضافة', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const removeOne = async () => {
    if (!groupId || !removeTarget) return
    setWorking(true)
    try {
      await frappeClient.call('base_meena.api.hr_rotational_shifts.unassign', { name: groupId, employees: [removeTarget.employee] })
      toast({ title: 'تم الحذف' })
      setRemoveTarget(null)
      await load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  const removeSelected = async () => {
    if (!groupId) return
    setWorking(true)
    try {
      await frappeClient.call('base_meena.api.hr_rotational_shifts.unassign', { name: groupId, employees: Array.from(selected) })
      toast({ title: 'تم الحذف' })
      setBulkRemoveOpen(false)
      await load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.employee))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.employee)))
  const toggleOne = (employee: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(employee) ? next.delete(employee) : next.add(employee)
    return next
  })

  if (!groupId) {
    return (
      <div className="rounded border border-slate-200 bg-white p-4">
        <p className="text-[13px] text-slate-500">احفظ المجموعة أولاً لإضافة الموظفين إليها.</p>
      </div>
    )
  }

  const colSpan = 4

  return (
    <div className="rounded border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 bg-[var(--apex-thead)] px-3 h-12 flex-wrap">
        <span className="text-[13px] font-bold text-[var(--apex-text)] ml-auto">الموظفون</span>
        <Button
          onClick={openAdd}
          className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white rounded px-3 h-8 font-bold text-[12.5px]"
        >
          <Plus className="h-3.5 w-3.5 ml-1" strokeWidth={3} />
          اضافة موظف
        </Button>
        <Button
          variant="outline"
          disabled={selected.size === 0}
          onClick={() => setBulkRemoveOpen(true)}
          className="rounded px-3 h-8 font-bold text-[12.5px] border-[var(--apex-slate)] text-[var(--apex-slate)] disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5 ml-1" />
          حذف
        </Button>
      </div>

      <div className="overflow-x-auto bg-white">
        <table className="w-full text-[13px] text-right">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600 h-10">
              <th className="px-3 w-10 text-center">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="تحديد الكل" className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" />
              </th>
              <th className="px-3 font-bold whitespace-nowrap">اسم الموظف</th>
              <th className="px-3 font-bold whitespace-nowrap">تاريخ الإسناد</th>
              <th className="px-3 font-bold w-14 text-center whitespace-nowrap">حذف</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="p-0"><TableSkeleton rows={3} cols={colSpan} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="py-8">
                <EmptyState icon={UserX} title="لا يوجد موظفون في هذه المجموعة" description="اضغط «اضافة موظف» لإسناد موظفين لهذا الدوام" />
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.employee} className="border-b border-slate-100 hover:bg-slate-50/70 h-[46px]">
                  <td className="px-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(r.employee)}
                      onChange={() => toggleOne(r.employee)}
                      aria-label={`تحديد ${r.employee_name}`}
                      className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                    />
                  </td>
                  <td className="px-3 text-slate-700">{r.employee_name}</td>
                  <td className="px-3 text-slate-700">{r.create_shifts_after ? fmtDate(r.create_shifts_after) : '—'}</td>
                  <td className="px-3 text-center">
                    <button onClick={() => setRemoveTarget(r)} title="حذف" aria-label={`حذف ${r.employee_name}`} className="text-slate-400 hover:text-red-600 px-1">
                      <Trash2 className="h-[17px] w-[17px]" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>اضافة موظف</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <span className="block text-[13px] text-slate-600">الموظف</span>
              {loadingAvailable ? (
                <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
              ) : (
                <EmployeeCombobox options={available} value={pick} onChange={setPick} placeholder="اختر موظف" />
              )}
            </div>
            <div className="space-y-1.5">
              <span className="block text-[13px] text-slate-600">تاريخ الإسناد</span>
              {/* A past date is rejected server-side too (assign_employees) —
                  rotational-gap.md item 4: a rotation's coverage is always
                  future(-or-today), never re-materialised into history. */}
              <Input
                type="date"
                value={fromDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded border-slate-300"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={addEmployee} disabled={saving || !pick} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white">
              {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              اضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}
        title="حذف موظف من الدوام"
        description={`هل تريد حذف «${removeTarget?.employee_name}» من هذا الدوام؟`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={removeOne}
      />
      <ConfirmDialog
        open={bulkRemoveOpen}
        onOpenChange={setBulkRemoveOpen}
        title="حذف الموظفين المحددين"
        description={`هل تريد حذف ${selected.size} موظف من هذا الدوام؟`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={removeSelected}
      />
    </div>
  )
}
