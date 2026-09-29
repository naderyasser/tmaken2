'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { leaveTypeAr } from '@/lib/enums'

/**
 * Apex «التقارير» table layouts: collapsible branch (#c0defa) → employee/day
 * (#d3e9fa) → leaf rows, the 21px green(open)/blue(closed) toggle, centred
 * headers and HH:MM durations. Each report picks its nesting via APEX_LAYOUTS;
 * reports not listed there keep ReportPage's generic grouped table.
 */

export interface Column { key: string; label: string; children?: Column[] }
export interface Group { title: string; rows: Record<string, any>[]; day?: string; date?: string }
export interface ReportData { columns: Column[]; groups: Group[]; total: number }

type Cell = { label: string; value: string }

interface NestedSpec {
  /** top level = one row per branch (row.branch) */
  branch: boolean
  /** middle level: per employee or per date */
  mid?: 'employee' | 'day'
  midCells?: (rows: Record<string, any>[]) => Cell[]
  /** leaf column labels in the table head, or repeated under each open mid row */
  header: 'top' | 'inner'
  branchOpen: boolean
  midOpen: boolean
  /** Apex «الاجمالي»: no toggle column — the branch toggle sits in the first data column */
  noToggleColumn?: boolean
}

const empCells = (rows: Record<string, any>[]): Cell[] => [
  { label: 'كود الموظف', value: rows[0]?.code ?? '' },
  { label: 'الاسم', value: rows[0]?.name ?? '' },
  { label: 'الوظيفة', value: rows[0]?.designation ?? '' },
  { label: 'الدوام', value: rows.find((r) => r.shift)?.shift ?? '' },
]

export const APEX_LAYOUTS: Record<string, 'daystatus' | NestedSpec> = {
  daystatus: 'daystatus',
  incomplete: 'daystatus',
  detailed: { branch: true, mid: 'employee', midCells: empCells, header: 'inner', branchOpen: false, midOpen: false },
  total: { branch: true, header: 'top', branchOpen: true, midOpen: true, noToggleColumn: true },
  vacations: {
    branch: false, mid: 'employee', header: 'inner', branchOpen: true, midOpen: false,
    midCells: (rows) => [...empCells(rows),
      { label: 'اجمالي الايام', value: String(rows.reduce((s, r) => s + (Number(r.days) || 0), 0)) }],
  },
  delays: {
    branch: true, mid: 'employee', header: 'top', branchOpen: true, midOpen: false,
    midCells: (rows) => [...empCells(rows),
      { label: 'اجمالي التأخير', value: hm(rows.reduce((s, r) => s + (Number(r.late) || 0), 0)) }],
  },
  'late-early': { branch: true, mid: 'employee', midCells: empCells, header: 'inner', branchOpen: false, midOpen: false },
  overtime: {
    branch: true, mid: 'employee', header: 'top', branchOpen: true, midOpen: false,
    midCells: (rows) => [...empCells(rows),
      { label: 'اجمالي الاضافي', value: hm(rows.reduce((s, r) => s + (Number(r.extra) || 0), 0)) }],
  },
  'total-absence': {
    branch: true, mid: 'employee', header: 'top', branchOpen: true, midOpen: false,
    midCells: (rows) => [...empCells(rows), { label: 'اجمالي مدة الغياب', value: `${rows.length} يوم` }],
  },
  'by-branch': { branch: true, mid: 'employee', midCells: empCells, header: 'inner', branchOpen: false, midOpen: false },
  employees: { branch: true, header: 'top', branchOpen: true, midOpen: true, noToggleColumn: true },
  absences: {
    branch: true, mid: 'day', header: 'top', branchOpen: true, midOpen: false,
    midCells: (rows) => [
      { label: 'اليوم', value: rows[0]?.day_name ?? '' },
      { label: 'التاريخ', value: dmy(rows[0]?.date) },
    ],
  },
}

export function hm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes || 0))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function dmy(d?: string) {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('-') : d ?? ''
}

function fmtVal(key: string, v: any): string {
  if (v === null || v === undefined || v === '') return ''
  if ((key === 'late' || key === 'extra' || key === 'early') && typeof v === 'number') return hm(v)
  if (key === 'hours' && typeof v === 'number') return hm(v * 60)
  if (key === 'leave_type') return leaveTypeAr(v)
  return String(v)
}

function statusClass(key: string, v: any) {
  if (key !== 'status') return ''
  const s = String(v ?? '')
  if (s.includes('غياب')) return 'text-red-600 font-semibold'
  if (s.includes('حضور')) return 'text-emerald-600 font-semibold'
  if (s.includes('اجازة') || s.includes('عطلة')) return 'text-amber-600 font-semibold'
  return ''
}

const leaves = (cols: Column[]) => cols.flatMap((c) => (c.children?.length ? c.children : [c]))

export function ExpandBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'طي' : 'توسيع'}
      aria-expanded={open}
      className={cn('h-[21px] w-[21px] rounded flex items-center justify-center text-white',
        open ? 'bg-[var(--apex-green)]' : 'bg-[var(--apex-blue)]')}
    >
      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  )
}

/** open/closed per row id; `def` is the Apex default for that level */
function useToggles() {
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  return {
    isOpen: (id: string, def: boolean) => def !== flipped.has(id),
    toggle: (id: string) => setFlipped((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }),
  }
}

/** Two-row head when some columns have حضور/إنصراف children (green/red). */
function LeafHead({ cols, lead, pad, className }: { cols: Column[]; lead: number; pad: number; className?: string }) {
  const nested = cols.some((c) => c.children?.length)
  const blank = (n: number, k: string) => Array.from({ length: n }, (_, i) => <th key={k + i} />)
  return (
    <>
      <tr className={className}>
        {blank(lead, 'l')}
        {cols.map((c, i) => (
          <th key={c.key} colSpan={c.children?.length || 1}
              className={cn('py-3 px-2 font-bold whitespace-nowrap', i === 0 && !nested ? 'text-right' : 'text-center',
                c.key === 'in1' && 'text-green-700', c.key === 'out1' && 'text-red-600')}>
            {c.label}
          </th>
        ))}
        {blank(pad, 'p')}
      </tr>
      {nested && (
        <tr className="bg-white">
          {blank(lead, 'l2')}
          {cols.flatMap((c) => c.children?.length
            ? c.children.map((ch) => (
                <th key={ch.key} className={cn('py-2 px-2 font-bold text-center', ch.key.startsWith('out') ? 'text-red-600' : 'text-green-700')}>{ch.label}</th>
              ))
            : [<th key={c.key} />])}
          {blank(pad, 'p2')}
        </tr>
      )}
    </>
  )
}

function LeafRow({ r, cols, lead, pad }: { r: Record<string, any>; cols: Column[]; lead: number; pad: number }) {
  return (
    <tr className="border-b border-slate-200 bg-white hover:bg-slate-50">
      {Array.from({ length: lead }, (_, i) => <td key={'l' + i} />)}
      {cols.map((c, i) => (
        <td key={c.key} className={cn('py-2.5 px-2 whitespace-nowrap', i === 0 ? 'text-right' : 'text-center', statusClass(c.key, r[c.key]))}>
          {fmtVal(c.key, r[c.key])}
        </td>
      ))}
      {Array.from({ length: pad }, (_, i) => <td key={'p' + i} />)}
    </tr>
  )
}

function groupBy(rows: Record<string, any>[], key: (r: Record<string, any>) => string) {
  const m = new Map<string, Record<string, any>[]>()
  for (const r of rows) {
    const k = key(r)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
  }
  return [...m.entries()]
}

/** Branch → employee/day → rows, per NestedSpec. Keyed by the parent on each
 *  new result so expand/collapse state starts from the Apex defaults. */
export function NestedReport({ data, spec }: { data: ReportData; spec: NestedSpec }) {
  const { isOpen, toggle } = useToggles()
  const cols = data.columns
  const leafCols = leaves(cols)
  const L = leafCols.length
  const rows = useMemo(() => data.groups.flatMap((g) => g.rows), [data])
  const lead = spec.noToggleColumn ? 0 : 1
  const midWidth = spec.mid ? Math.max(L, spec.midCells?.(rows.slice(0, 1)).length ?? 0) : L
  const pad = midWidth - L
  const W = lead + midWidth

  const branches = spec.branch
    ? groupBy(rows, (r) => r.branch || 'بدون فرع').sort(([a], [b]) => a.localeCompare(b, 'ar'))
    : [['', rows] as [string, Record<string, any>[]]]
  const midKey = spec.mid === 'day' ? (r: Record<string, any>) => r.date : (r: Record<string, any>) => r.employee || r.code

  const renderMid = (bid: string, list: Record<string, any>[]) => {
    if (!spec.mid) return list.map((r, i) => <LeafRow key={bid + i} r={r} cols={leafCols} lead={lead} pad={pad} />)
    let mids = groupBy(list, midKey)
    if (spec.mid === 'day') mids = mids.sort(([a], [b]) => a.localeCompare(b))
    return mids.map(([k, rs]) => {
      const id = `${bid}|${k}`
      const open = isOpen(id, spec.midOpen)
      const cells = spec.midCells?.(rs) ?? []
      return (
        <Fragment key={id}>
          <tr className="bg-[#d3e9fa] text-slate-800">
            <td className="py-2 px-2 w-8"><ExpandBtn open={open} onClick={() => toggle(id)} /></td>
            {cells.map((c, i) => (
              <td key={c.label} colSpan={i === cells.length - 1 ? midWidth - cells.length + 1 : 1}
                  className={cn('py-2 px-2 whitespace-nowrap', i === 0 ? 'text-right' : 'text-center')}>
                <span className="font-bold">{c.label}:</span> {c.value}
              </td>
            ))}
          </tr>
          {open && spec.header === 'inner' && (
            <LeafHead cols={cols} lead={lead} pad={pad} className="bg-[var(--apex-thead)] text-slate-800" />
          )}
          {open && rs.map((r, i) => <LeafRow key={id + i} r={r} cols={leafCols} lead={lead} pad={pad} />)}
        </Fragment>
      )
    })
  }

  return (
    <div className="overflow-x-auto rounded-sm">
      <table className="w-full text-[14px] border-collapse">
        {spec.header === 'top' && (
          <thead className="bg-[var(--apex-thead)] text-slate-800">
            <LeafHead cols={cols} lead={lead} pad={pad} />
          </thead>
        )}
        <tbody>
          {branches.map(([b, list]) => {
            if (!spec.branch) return <Fragment key="all">{renderMid('all', list)}</Fragment>
            const id = `b|${b}`
            const open = isOpen(id, spec.branchOpen)
            return (
              <Fragment key={id}>
                <tr className="bg-[#c0defa] text-slate-800">
                  <td className="py-2 px-2 w-8"><ExpandBtn open={open} onClick={() => toggle(id)} /></td>
                  <td colSpan={W - 1} className="py-2 px-2 text-right"><span className="font-bold">الفرع :</span> {b}</td>
                </tr>
                {open && renderMid(id, list)}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Apex «حالة اليوم» / «الحركات الغير مكتملة»: one collapsible row per date («اليوم : …» under the
 * code/name columns, «التاريخ : …» centred), employees below it; head with
 * الوردية الاولي/الثانية split into green حضور / red إنصراف.
 */
export function DayStatusTable({ data }: { data: ReportData }) {
  const { isOpen, toggle } = useToggles()
  const cols = data.columns
  const leafCols = leaves(cols)
  const L = leafCols.length
  const dateSpan = Math.min(4, Math.max(L - 3, 1))
  const rest = L - 3 - dateSpan
  return (
    <div className="overflow-x-auto rounded-sm">
      <table className="w-full text-[14px] border-collapse">
        <thead className="bg-[var(--apex-thead)] text-slate-800">
          <LeafHead cols={cols} lead={1} pad={0} />
        </thead>
        <tbody>
          {data.groups.map((g, gi) => {
            const id = g.date ?? String(gi)
            const open = isOpen(id, true)
            return (
              <Fragment key={id}>
                <tr className="bg-[#c0defa] text-slate-800">
                  <td className="py-2 px-2 w-8"><ExpandBtn open={open} onClick={() => toggle(id)} /></td>
                  <td colSpan={2} className="py-2 px-2 text-center whitespace-nowrap"><span className="font-bold">اليوم : </span>{g.day}</td>
                  <td />
                  <td colSpan={dateSpan} className="py-2 px-2 text-center whitespace-nowrap"><span className="font-bold">التاريخ : </span>{g.date}</td>
                  {rest > 0 && <td colSpan={rest} />}
                </tr>
                {open && g.rows.map((r, i) => <LeafRow key={id + i} r={r} cols={leafCols} lead={1} pad={0} />)}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
