'use client'

/**
 * «أعضاء مجموعة الموظفين» (Apex M3, `hr/employeeGroups/specificEmployeeGroup`)
 * — members of one Employee Group: الكود · اسم الموظف · الفرع · الدوام, add
 * via the employee combobox, bulk remove, print. `?group=<name>`.
 *
 * Backed by `base_meena.api.hr_groups`. See apex-gap-analysis.md §1 M3.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Plus, Printer, Trash2, UserX } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'
import { EmployeeCombobox } from '@/components/hr/devices/employee-combobox'
import type { UnmappedEmployee } from '@/components/hr/devices/types'

interface MemberRow {
  employee: string
  employee_name: string
  branch?: string | null
  default_shift?: string | null
}

export function EmployeeGroupMembersPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const group = searchParams.get('group') || ''

  const [groupName, setGroupName] = useState('')
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [addOpen, setAddOpen] = useState(false)
  const [available, setAvailable] = useState<UnmappedEmployee[]>([])
  const [pick, setPick] = useState('')
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    if (!group) { setLoading(false); return }
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_groups.get_group_members', { group })
      setGroupName(r?.message?.group_name || group)
      setRows(r?.message?.members ?? [])
      setSelected(new Set())
    } catch (e: any) {
      toast({ title: 'فشل تحميل أعضاء المجموعة', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [group, toast])
  useEffect(() => { load() }, [load])

  const openAdd = async () => {
    setPick('')
    setAddOpen(true)
    setLoadingAvailable(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_groups.get_available_employees', { group })
      setAvailable(r?.message ?? [])
    } catch (e: any) {
      toast({ title: 'فشل تحميل الموظفين', description: e?.message, variant: 'destructive' })
      setAvailable([])
    } finally {
      setLoadingAvailable(false)
    }
  }

  const addMember = async () => {
    if (!pick) return
    setSaving(true)
    try {
      await frappeClient.call('base_meena.api.hr_groups.add_group_members', { group, employees: [pick] })
      toast({ title: 'تمت الإضافة' })
      setAddOpen(false)
      await load()
    } catch (e: any) {
      toast({ title: 'فشل الإضافة', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const removeOne = async () => {
    if (!removeTarget) return
    setWorking(true)
    try {
      await frappeClient.call('base_meena.api.hr_groups.remove_group_members', { group, employees: [removeTarget.employee] })
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
    setWorking(true)
    try {
      await frappeClient.call('base_meena.api.hr_groups.remove_group_members', { group, employees: Array.from(selected) })
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
  const toggleOne = (employee: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(employee)) next.delete(employee); else next.add(employee)
      return next
    })
  }

  if (!group) {
    return (
      <div className="px-4 pt-6" dir="rtl">
        <EmptyState title="لم يتم تحديد مجموعة" description="افتح هذه الصفحة من قائمة مجموعات الموظفين" />
      </div>
    )
  }

  const colSpan = 5

  return (
    <div className="p-4" dir="rtl">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[14px] text-slate-700">
          <span className="text-slate-600">البيانات الاساسية</span><span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-600">مجموعات الموظفين</span><span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-800 font-bold">{groupName}</span>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden print:hidden">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 flex-wrap">
          <Button
            onClick={openAdd}
            className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white rounded px-4 h-9 font-bold text-[13px] shrink-0"
          >
            <Plus className="h-4 w-4 ml-1" strokeWidth={3} />
            اضافة موظف
          </Button>
          <Button
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => setBulkRemoveOpen(true)}
            className="rounded px-4 h-9 font-bold text-[13px] shrink-0 border-[var(--apex-slate)] text-[var(--apex-slate)] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4 ml-1" />
            حذف
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="rounded px-4 h-9 font-bold text-[13px] border-[var(--apex-slate)] text-[var(--apex-slate)] shrink-0 mr-auto"
          >
            <Printer className="h-4 w-4 ml-1" />
            الطباعة
          </Button>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-right">
            <thead>
              <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
                <th className="px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                    aria-label="تحديد الكل"
                  />
                </th>
                <th className="px-3 w-10 text-center font-bold">الكود</th>
                <th className="px-3 font-bold whitespace-nowrap">اسم الموظف</th>
                <th className="px-3 font-bold whitespace-nowrap">الفرع</th>
                <th className="px-3 font-bold whitespace-nowrap">الدوام</th>
                <th className="px-3 font-bold w-16 text-center whitespace-nowrap print:hidden">حذف</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan + 1} className="p-0"><TableSkeleton rows={6} cols={colSpan + 1} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={colSpan + 1} className="py-10">
                  <EmptyState
                    icon={UserX}
                    title="لا يوجد أعضاء في هذه المجموعة"
                    description="اضغط «اضافة موظف» لإضافة أعضاء"
                  />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.employee} className="border-b border-slate-100 hover:bg-slate-50/70 h-[52px]">
                    <td className="px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(r.employee)}
                        onChange={() => toggleOne(r.employee)}
                        className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                        aria-label={`تحديد ${r.employee_name}`}
                      />
                    </td>
                    <td className="px-3 text-center text-slate-500">{r.employee}</td>
                    <td className="px-3 text-slate-700">{r.employee_name}</td>
                    <td className="px-3 text-slate-700">{r.branch || '—'}</td>
                    <td className="px-3 text-slate-700">{r.default_shift || '—'}</td>
                    <td className="px-3 print:hidden">
                      <div className="flex items-center justify-center">
                        <button onClick={() => setRemoveTarget(r)} title="حذف" aria-label={`حذف ${r.employee_name}`} className="text-slate-400 hover:text-red-600 px-1">
                          <Trash2 className="h-[17px] w-[17px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Print-only view ── */}
      {rows.length > 0 && (
        <div className="hidden print:block">
          <h1 className="text-lg font-bold mb-1">أعضاء مجموعة الموظفين — {groupName}</h1>
          <table className="w-full text-xs border-collapse mt-4">
            <thead>
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-center">الكود</th>
                <th className="border border-slate-300 px-2 py-1 text-right">اسم الموظف</th>
                <th className="border border-slate-300 px-2 py-1 text-right">الفرع</th>
                <th className="border border-slate-300 px-2 py-1 text-right">الدوام</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee}>
                  <td className="border border-slate-300 px-2 py-1 text-center">{r.employee}</td>
                  <td className="border border-slate-300 px-2 py-1">{r.employee_name}</td>
                  <td className="border border-slate-300 px-2 py-1">{r.branch || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1">{r.default_shift || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add member dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>اضافة موظف — {groupName}</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-1">
            <span className="block text-[13px] text-slate-600">الموظف</span>
            {loadingAvailable ? (
              <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
            ) : (
              <EmployeeCombobox options={available} value={pick} onChange={setPick} placeholder="اختر موظف" />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={addMember} disabled={saving || !pick} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white">
              {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              اضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="حذف عضو من المجموعة"
        description={`هل تريد حذف «${removeTarget?.employee_name}» من هذه المجموعة؟`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={removeOne}
      />

      <ConfirmDialog
        open={bulkRemoveOpen}
        onOpenChange={setBulkRemoveOpen}
        title="حذف الأعضاء المحددين"
        description={`هل تريد حذف ${selected.size} عضو من هذه المجموعة؟`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={removeSelected}
      />
    </div>
  )
}
