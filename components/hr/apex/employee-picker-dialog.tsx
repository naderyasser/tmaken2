'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { ApexDialog } from '@/components/hr/apex/dialog'

export interface PickerEmployee {
  name: string; employee_name: string; employee_number?: string; branch?: string; department?: string
  custom_section?: string; designation?: string; default_shift?: string; custom_employee_group?: string
}

const FIELDS = ['name', 'employee_name', 'employee_number', 'branch', 'department', 'custom_section', 'designation', 'default_shift', 'custom_employee_group']
const INPUT = 'h-[42px] w-full rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

type Criteria = { code: string; name: string; branch: string; department: string; section: string; designation: string; shift: string; group: string }
const EMPTY: Criteria = { code: '', name: '', branch: '', department: '', section: '', designation: '', shift: '', group: '' }
const has = (v: unknown, q: string) => !q || String(v ?? '').toLowerCase().includes(q.trim().toLowerCase())

/**
 * Apex «تحديد الموظف» (app-add-modal «بحث»): الكود · الاسم · الفرع · اسم الادارة ·
 * اسم القسم · الوظيفة · الدوام · المجموعة, 🔍, then a ☐ · رقم · الاسم list —
 * «اضافة» hands the ticked employees back.
 */
export function EmployeePickerDialog({ open, onOpenChange, initial, onAdd }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** already-chosen employee names (pre-ticked) */
  initial?: Set<string>
  onAdd: (employees: PickerEmployee[]) => void
}) {
  const [emps, setEmps] = useState<PickerEmployee[]>([])
  const [draft, setDraft] = useState<Criteria>(EMPTY)
  const [applied, setApplied] = useState<Criteria>(EMPTY)
  const [ticked, setTicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setTicked(new Set(initial ?? []))
    if (emps.length) return
    frappeClient.getList<PickerEmployee>('Employee', {
      fields: FIELDS, filters: [['status', '=', 'Active']], order_by: 'employee_name asc', limit_page_length: 0,
    }).then(setEmps).catch(() => setEmps([]))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => emps.filter((e) =>
    has(e.employee_number || e.name, applied.code) && has(e.employee_name, applied.name) && has(e.branch, applied.branch)
    && has(e.department, applied.department) && has(e.custom_section, applied.section) && has(e.designation, applied.designation)
    && has(e.default_shift, applied.shift) && has(e.custom_employee_group, applied.group),
  ), [emps, applied])

  const allTicked = rows.length > 0 && rows.every((e) => ticked.has(e.name))
  const toggle = (n: string) => setTicked((p) => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
  const toggleAll = () => setTicked((p) => {
    const s = new Set(p)
    rows.forEach((e) => (allTicked ? s.delete(e.name) : s.add(e.name)))
    return s
  })
  const input = (k: keyof Criteria, label: string) => (
    <div>
      <label className="block text-[13px] text-slate-700 mb-1">{label}</label>
      <input value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') setApplied(draft) }} className={INPUT} />
    </div>
  )

  return (
    <ApexDialog open={open} onOpenChange={onOpenChange} title="بحث" size="lg"
      primary={{ label: 'اضافة', onClick: () => { onAdd(emps.filter((e) => ticked.has(e.name))); onOpenChange(false) }, disabled: ticked.size === 0 }}>
      <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
        {input('code', 'الكود')}
        {input('name', 'الاسم')}
        {input('branch', 'الفرع')}
        {input('department', 'اسم الادارة')}
        {input('section', 'اسم القسم')}
        {input('designation', 'الوظيفة')}
        {input('shift', 'الدوام')}
        {input('group', 'المجموعة')}
        <div className="flex items-end">
          <button type="button" onClick={() => setApplied(draft)} aria-label="بحث"
            className="h-[42px] w-[42px] rounded bg-[var(--apex-blue)] text-white flex items-center justify-center hover:opacity-90">
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="col-span-2 max-h-[320px] overflow-y-auto border border-slate-200 rounded">
        <table className="w-full text-[14px]">
          <thead className="sticky top-0 bg-[var(--apex-thead)] text-[var(--apex-text)]">
            <tr className="h-10">
              <th className="w-[10%] text-center">
                <input type="checkbox" aria-label="تحديد الكل" checked={allTicked} onChange={toggleAll} className="h-4 w-4 accent-[var(--apex-blue)]" />
              </th>
              <th className="text-center font-bold">رقم</th>
              <th className="text-center font-bold">الاسم</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="py-6 text-center text-slate-500">لا يوجد نتائج للبحث</td></tr>
            ) : rows.map((e) => (
              <tr key={e.name} className="border-t border-slate-100 h-9 hover:bg-slate-50 cursor-pointer" onClick={() => toggle(e.name)}>
                <td className="text-center" onClick={(ev) => ev.stopPropagation()}>
                  <input type="checkbox" aria-label={`تحديد ${e.employee_name}`} checked={ticked.has(e.name)} onChange={() => toggle(e.name)} className="h-4 w-4 accent-[var(--apex-blue)]" />
                </td>
                <td className="text-center">{e.employee_number || e.name}</td>
                <td className="text-center">{e.employee_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ApexDialog>
  )
}
