'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, UserX } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'
import { EmployeeCombobox } from '@/components/hr/devices/employee-combobox'
import type { UnmappedEmployee } from '@/components/hr/devices/types'
import type { GroupEmployee } from './types'

/** «موظفو المجموعة» — the employees currently scoped to this location group
 *  (via `Employee.custom_location_group`), with add (combobox, searches
 *  employees not already in this group) / remove (clears the field back to
 *  empty — an employee always belongs to at most one group). */
export function GroupEmployeesPanel({ group, onChanged }: { group: string; onChanged?: () => void }) {
  const { toast } = useToast()
  const [employees, setEmployees] = useState<GroupEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<UnmappedEmployee[]>([])
  const [picked, setPicked] = useState('')
  const [adding, setAdding] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<GroupEmployee | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call<GroupEmployee[]>('base_meena.api.hr_location_groups.get_group_employees', { group })
      setEmployees(r?.message ?? [])
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل موظفي المجموعة', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [group, toast])

  const loadCandidates = useCallback(async () => {
    try {
      const r: any = await frappeClient.call<UnmappedEmployee[]>('base_meena.api.hr_location_groups.get_available_employees', { group })
      setCandidates(r?.message ?? [])
    } catch { /* combobox just stays empty */ }
  }, [group])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCandidates() }, [loadCandidates])

  const addEmployee = async () => {
    if (!picked) return
    setAdding(true)
    try {
      await frappeClient.call('base_meena.api.hr_location_groups.set_employee_group', { employees: [picked], group })
      toast({ title: 'تمت إضافة الموظف للمجموعة' })
      setPicked('')
      await Promise.all([load(), loadCandidates()])
      onChanged?.()
    } catch (e: any) {
      toast({ title: 'تعذّر إضافة الموظف', description: e?.message, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await frappeClient.call('base_meena.api.hr_location_groups.set_employee_group', { employees: [removeTarget.name], group: '' })
      toast({ title: 'تم إخراج الموظف من المجموعة' })
      setRemoveTarget(null)
      await Promise.all([load(), loadCandidates()])
      onChanged?.()
    } catch (e: any) {
      toast({ title: 'تعذّر إخراج الموظف', description: e?.message, variant: 'destructive' })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-slate-100">
        <h2 className="text-[15px] font-bold text-[var(--apex-navy)]">موظفو المجموعة</h2>
        <div className="flex items-center gap-2">
          <div className="w-56">
            <EmployeeCombobox options={candidates} value={picked} onChange={setPicked} placeholder="اختر موظف لإضافته" />
          </div>
          <button
            type="button"
            onClick={addEmployee}
            disabled={!picked || adding}
            className="h-9 px-3 rounded bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white text-[13px] font-bold flex items-center gap-1 disabled:opacity-50 shrink-0"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={3} />}
            اضافة
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] text-right">
          <thead>
            <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-10">
              <th className="px-3 font-bold whitespace-nowrap">اسم الموظف</th>
              <th className="px-3 font-bold whitespace-nowrap">الفرع</th>
              <th className="px-3 font-bold whitespace-nowrap">الإدارة</th>
              <th className="px-3 font-bold whitespace-nowrap">الوظيفة</th>
              <th className="px-3 font-bold w-24 text-center">إزالة</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-0"><TableSkeleton rows={3} cols={5} /></td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={5} className="py-8"><EmptyState title="لا يوجد موظفون في هذه المجموعة بعد" /></td></tr>
            ) : (
              employees.map((e) => (
                <tr key={e.name} className="border-b border-slate-100 hover:bg-slate-50/70 h-11">
                  <td className="px-3 text-slate-700 whitespace-nowrap">{e.employee_name}</td>
                  <td className="px-3 text-slate-700 whitespace-nowrap">{e.branch || '—'}</td>
                  <td className="px-3 text-slate-700 whitespace-nowrap">{e.department || '—'}</td>
                  <td className="px-3 text-slate-700 whitespace-nowrap">{e.designation || '—'}</td>
                  <td className="px-3 text-center">
                    <button type="button" onClick={() => setRemoveTarget(e)} title="إزالة من المجموعة" className="text-slate-400 hover:text-red-600 px-1">
                      <UserX className="h-[17px] w-[17px]" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}
        title="إزالة موظف من المجموعة"
        description={removeTarget ? `سيتم إخراج "${removeTarget.employee_name}" من مجموعة المواقع هذه.` : ''}
        confirmLabel="إزالة"
        cancelLabel="إلغاء"
        loading={removing}
        onConfirm={confirmRemove}
      />
    </div>
  )
}
