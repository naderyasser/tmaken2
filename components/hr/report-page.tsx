'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Search, AlertCircle } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { fmtDate } from '@/lib/hr-format'
import { leaveTypeAr } from '@/lib/enums'
import type { ReportConfig } from '@/lib/hr-reports'
import { PrintDialog } from '@/components/hr/apex/print-dialog'
import { ExportMenu, SERVER_PRINTABLE_REPORTS } from '@/components/hr/apex/export-menu'
import { ApexDatePicker } from '@/components/hr/apex/date-picker'

interface Column { key: string; label: string; children?: Column[] }
interface Group { title: string; rows: Record<string, any>[] }
interface ReportData { columns: Column[]; groups: Group[]; total: number; from_date: string; to_date: string }
interface Options {
  branches: string[]; departments: string[]; designations: string[]; shifts: string[]; projects: string[]
  groups: string[]; leave_types: string[]; permission_types: string[]
}

const EMPTY_OPTIONS: Options = {
  branches: [], departments: [], designations: [], shifts: [], projects: [], groups: [], leave_types: [], permission_types: [],
}

let optionsCache: Options | null = null

function today() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Apex «التقارير» screen — breadcrumb, [تصدير▾] [اخفاء البحث▾], the shared
 * filter grid, an illustration until the first search, then the grouped table.
 * Read-only: running a report never writes anything.
 */
export function ReportPage({ config, breadcrumb = ['الحضور و الانصراف', 'التقارير'], addSlot, defaultFrom = 'today', reloadKey = 0 }: {
  config: ReportConfig
  breadcrumb?: string[]
  /** optional leading toolbar button (e.g. «اضافة» on the movements page) */
  addSlot?: React.ReactNode
  /** initial «من تاريخ»: today, or the first of the month (Apex movements page) */
  defaultFrom?: 'today' | 'month'
  /** bump to re-run the current search (after an add/edit) */
  reloadKey?: number
}) {
  const { toast } = useToast()
  const [opts, setOpts] = useState<Options>(optionsCache ?? EMPTY_OPTIONS)
  const [showFilters, setShowFilters] = useState(true)
  const [printOpen, setPrintOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [f, setF] = useState<Record<string, string>>({
    employee: '', branch: '', department: '', section: '', project: '', designation: '', group: '', shift: '',
    from_date: defaultFrom === 'month' ? today().slice(0, 8) + '01' : today(), to_date: today(),
    leave_type: '', permission_type: '', status: '',
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }))
  const setDate = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  // reset when switching between reports
  useEffect(() => { setData(null); setError(null); setCollapsed(new Set()) }, [config.slug])

  useEffect(() => {
    if (optionsCache) return
    frappeClient.call<Options>('base_meena.api.hr_reports.get_filter_options')
      .then((r: any) => { optionsCache = r?.message ?? EMPTY_OPTIONS; setOpts(optionsCache!) })
      .catch(() => {})
  }, [])

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters = { ...f }
      if (!config.dates) { delete filters.from_date; delete filters.to_date }
      const r: any = await frappeClient.call<ReportData>('base_meena.api.hr_reports.run_report', {
        report: config.report, filters: JSON.stringify(filters),
      })
      setData(r?.message ?? null)
      setCollapsed(new Set())
    } catch (e: any) {
      const msg = e?.message || 'تعذّر تحميل التقرير'
      setError(msg)
      toast({ title: 'خطأ', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [config, f, toast])

  // re-run after the parent changed data (add / delete)
  useEffect(() => { if (reloadKey && data) run() }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // same shape run_report/report_pdf expect — mirrors `run()`'s own filters object
  // so the PDF/طباعة menu always reflects exactly what's on screen.
  const activeFilters = useMemo(() => {
    const filters = { ...f }
    if (!config.dates) { delete filters.from_date; delete filters.to_date }
    return filters
  }, [f, config.dates])

  // flat leaf columns for the body
  const leafCols = useMemo(() => {
    if (!data) return []
    const out: Column[] = []
    for (const c of data.columns) (c.children?.length ? out.push(...c.children) : out.push(c))
    return out
  }, [data])
  const hasChildren = !!data?.columns.some((c) => c.children?.length)

  const exportCsv = () => {
    if (!data) return
    const head = leafCols.map((c) => c.label)
    const lines = [head.join(',')]
    for (const g of data.groups) {
      if (g.title) lines.push(`"${g.title}"`)
      for (const r of g.rows) lines.push(leafCols.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${config.title}.csv`
    a.click()
  }

  const toggleGroup = (i: number) =>
    setCollapsed((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })

  return (
    <div className="px-4 pt-3 pb-8" dir="rtl">
      {/* Print-only header — shown only inside @media print (app/globals.css),
          while the breadcrumb/toolbar/filters/screen chrome below are hidden. */}
      {data && (
        <div className="hidden print:block mb-4">
          <h1 className="text-lg font-bold mb-1">{config.title}</h1>
          <p className="text-xs text-slate-500">
            {config.dates && f.from_date && f.to_date
              ? `من ${fmtDate(f.from_date)} إلى ${fmtDate(f.to_date)}`
              : fmtDate(new Date())}
          </p>
        </div>
      )}

      {/* breadcrumb + toolbar */}
      <div className="flex items-center justify-between mb-5 print:hidden">
        <div className="text-[14px] text-slate-700">
          {[...breadcrumb, config.title].map((b, i, arr) => (
            <span key={i}>
              <span className={i === arr.length - 1 ? 'text-slate-800' : 'text-slate-600'}>{b}</span>
              {i < arr.length - 1 && <span className="mx-2 text-slate-400">/</span>}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="h-[38px] px-3 rounded border border-[var(--apex-blue-border)] bg-white text-[14px] text-[var(--apex-blue)] flex items-center gap-1"
          >
            <ChevronDown className="h-4 w-4" />
            {showFilters ? 'اخفاء البحث' : 'اظهار البحث'}
          </button>
          {(SERVER_PRINTABLE_REPORTS as readonly string[]).includes(config.report) ? (
            <ExportMenu report={config.report} filters={activeFilters} onAdvancedPrint={() => setPrintOpen(true)} />
          ) : (
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="h-[38px] px-3 min-w-[120px] rounded border border-[var(--apex-blue-border)] bg-white text-[14px] text-[var(--apex-blue)] flex items-center justify-between gap-3"
            >
              <ChevronDown className="h-4 w-4" />
              <span>تصدير</span>
            </button>
          )}
          {addSlot}
        </div>
      </div>

      <PrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        templates={[{ key: 'default', label: config.title, isDefault: true }]}
        storageKey={`report:${config.slug}`}
        onPrint={() => { setPrintOpen(false); window.print() }}
        onExport={(o) => { setPrintOpen(false); if (o.format === 'excel') exportCsv(); else window.print() }}
      />

      {/* filter grid */}
      {showFilters && (
        <div className="space-y-4 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Txt value={f.employee} onChange={set('employee')} label="كود أو إسم الموظف" />
            <Sel value={f.branch} onChange={set('branch')} label="الفروع" items={opts.branches} />
            <Sel value={f.department} onChange={set('department')} label="الإدارة" items={opts.departments} />
            {/* «القسم» used to reuse opts.departments verbatim — an exact duplicate
                of «الإدارة» right next to it, not a distinct filter. get_filter_options
                has no separate custom_section catalogue to back a real one, so the
                duplicate is dropped rather than kept broken. */}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Sel value={f.project} onChange={set('project')} label="المشروع" items={opts.projects} />
            <Sel value={f.designation} onChange={set('designation')} label="الوظيفة" items={opts.designations} />
            <Sel value={f.group} onChange={set('group')} label="المجموعة" items={opts.groups} />
            <Sel value={f.shift} onChange={set('shift')} label="الدوام" items={opts.shifts} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
            {config.extras?.includes('status') && <Sel value={f.status} onChange={set('status')} label="الحالة" items={['مقبولة', 'مرفوضة']} />}
            {config.extras?.includes('leave_type') && <Sel value={f.leave_type} onChange={set('leave_type')} label="نوع الاجازة" items={opts.leave_types} labelFor={leaveTypeAr} />}
            {config.extras?.includes('permission_type') && <Sel value={f.permission_type} onChange={set('permission_type')} label="نوع الاذن" items={opts.permission_types} />}
            {config.dates && <ApexDatePicker value={f.from_date} onChange={setDate('from_date')} label="من تاريخ" required />}
            {config.dates && <ApexDatePicker value={f.to_date} onChange={setDate('to_date')} label="إلى تاريخ" required />}
            <div>
              <button
                type="button"
                onClick={run}
                disabled={loading}
                className="h-[42px] w-[42px] rounded bg-[var(--apex-blue)] text-white flex items-center justify-center disabled:opacity-60"
                aria-label="بحث"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* body */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-[14px] mb-4"><AlertCircle className="h-4 w-4" />{error}</div>
      )}
      {!data && !loading && <ReportIllustration />}
      {loading && !data && (
        <div className="flex justify-center py-16 text-slate-500"><Loader2 className="h-8 w-8 animate-spin" /></div>
      )}
      {data && (
        <div className="overflow-x-auto rounded-sm">
          <table className="w-full text-[14px] border-collapse">
            <thead>
              <tr className="bg-[var(--apex-thead)] text-slate-800">
                <th className="w-10 py-3" rowSpan={hasChildren ? 2 : 1} />
                {data.columns.map((c) => (
                  <th key={c.key} colSpan={c.children?.length || 1} rowSpan={hasChildren && !c.children?.length ? 2 : 1}
                      className="py-3 px-2 font-bold text-right whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
              {hasChildren && (
                <tr className="bg-[var(--apex-thead)] text-slate-800">
                  {data.columns.flatMap((c) => c.children ?? []).map((c) => (
                    <th key={c.key} className={cn('py-2 px-2 font-bold text-right bg-white', c.key.startsWith('out') ? 'text-red-600' : 'text-[var(--apex-blue)]')}>{c.label}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {data.groups.map((g, gi) => (
                <GroupRows key={gi} g={g} gi={gi} cols={leafCols} collapsed={collapsed.has(gi)} onToggle={() => toggleGroup(gi)} />
              ))}
              {data.total === 0 && (
                <tr><td colSpan={leafCols.length + 1} className="py-10 text-center text-slate-500">لا يوجد نتائج للبحث ابحث مرة اخري</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


type Change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void

/** `labelFor` translates an option's display text (e.g. Leave Type's English
 *  name → Arabic via lib/enums.leaveTypeAr) — the submitted `value` stays the
 *  raw option exactly as the backend filter expects. */
function Sel({ value, onChange, label, items, labelFor }: { value: string; onChange: Change; label: string; items: string[]; labelFor?: (v: string) => string }) {
  return (
    <div className="relative">
      {value && <span className="absolute -top-5 right-1 text-[13px] text-slate-700">{label}</span>}
      <select
        value={value}
        onChange={onChange}
        className={cn(
          'w-full h-[42px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 appearance-none',
          !value && 'text-slate-400',
        )}
      >
        <option value="">{label}</option>
        {items.map((o) => <option key={o} value={o}>{labelFor ? labelFor(o) : o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
    </div>
  )
}

function Txt({ value, onChange, label }: { value: string; onChange: Change; label: string }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={label}
      className="w-full h-[42px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[var(--apex-blue)]"
    />
  )
}


function GroupRows({ g, gi, cols, collapsed, onToggle }: {
  g: Group; gi: number; cols: Column[]; collapsed: boolean; onToggle: () => void
}) {
  return (
    <>
      {g.title && (
        <tr className="bg-[var(--apex-row-group)] text-slate-800">
          <td className="py-2 px-2">
            <button type="button" onClick={onToggle} className="h-6 w-6 rounded bg-[var(--apex-blue)] text-white flex items-center justify-center" aria-label="طي">
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </td>
          <td colSpan={cols.length} className="py-2 px-2 font-semibold whitespace-pre">{g.title}</td>
        </tr>
      )}
      {!collapsed && g.rows.map((r, ri) => (
        <tr key={ri} className="border-b border-slate-200 bg-white hover:bg-slate-50">
          <td />
          {cols.map((c) => (
            <td key={c.key} className={cn('py-2.5 px-2 whitespace-nowrap', cellClass(c.key, r[c.key]))}>
              {c.key === 'leave_type' ? leaveTypeAr(r[c.key]) : fmt(r[c.key])}
            </td>
          ))}
        </tr>
      ))}
      {!collapsed && g.title && g.rows.length === 0 && (
        <tr><td /><td colSpan={cols.length} className="py-3 px-2 text-slate-400 text-[13px]">لا توجد بيانات</td></tr>
      )}
    </>
  )
}

function fmt(v: any) {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

function cellClass(key: string, v: any) {
  if (key === 'status') {
    const s = String(v ?? '')
    if (s.includes('غياب')) return 'text-red-600 font-semibold'
    if (s.includes('حضور')) return 'text-emerald-600 font-semibold'
    if (s.includes('اجازة') || s.includes('عطلة')) return 'text-amber-600 font-semibold'
  }
  if ((key === 'late' || key === 'early') && Number(v) > 0) return 'text-red-600'
  if (key === 'extra' && Number(v) > 0) return 'text-emerald-600'
  return ''
}

/** The "chart clipboard" placeholder shown before the first search. */
export function ReportIllustration() {
  return (
    <div className="flex justify-center py-14">
      <svg width="270" height="260" viewBox="0 0 270 260" fill="none" aria-hidden="true">
        <rect x="8" y="30" width="200" height="150" rx="6" fill="#fff" stroke="var(--apex-navy)" strokeWidth="6" />
        <rect x="30" y="52" width="70" height="8" rx="3" fill="var(--apex-navy)" />
        <rect x="30" y="70" width="90" height="8" rx="3" fill="var(--apex-navy)" />
        <rect x="30" y="88" width="60" height="8" rx="3" fill="var(--apex-navy)" />
        <rect x="30" y="106" width="80" height="8" rx="3" fill="var(--apex-navy)" />
        <rect x="34" y="140" width="16" height="30" rx="2" fill="#fff" stroke="var(--apex-navy)" strokeWidth="5" />
        <rect x="60" y="126" width="16" height="44" rx="2" fill="var(--apex-success)" stroke="var(--apex-navy)" strokeWidth="5" />
        <rect x="86" y="118" width="16" height="52" rx="2" fill="#fff" stroke="var(--apex-navy)" strokeWidth="5" />
        <rect x="112" y="136" width="16" height="34" rx="2" fill="var(--apex-success)" stroke="var(--apex-navy)" strokeWidth="5" />
        <polyline points="130,120 152,100 172,110 196,80 214,70" fill="none" stroke="var(--apex-navy)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="130" cy="120" r="7" fill="var(--apex-blue-accent)" stroke="var(--apex-navy)" strokeWidth="4" />
        <circle cx="152" cy="100" r="7" fill="var(--apex-blue-accent)" stroke="var(--apex-navy)" strokeWidth="4" />
        <circle cx="172" cy="110" r="7" fill="var(--apex-blue-accent)" stroke="var(--apex-navy)" strokeWidth="4" />
        <circle cx="196" cy="80" r="7" fill="var(--apex-blue-accent)" stroke="var(--apex-navy)" strokeWidth="4" />
        <circle cx="228" cy="50" r="22" fill="var(--apex-blue-accent)" stroke="var(--apex-navy)" strokeWidth="6" />
        <circle cx="190" cy="205" r="40" fill="#fff" stroke="var(--apex-navy)" strokeWidth="6" />
        <path d="M190 165 A40 40 0 0 1 230 205 L210 205 A20 20 0 0 0 190 185 Z" fill="var(--apex-blue-accent)" />
        <path d="M150 205 A40 40 0 0 1 190 165 L190 185 A20 20 0 0 0 170 205 Z" fill="var(--apex-success)" />
        <circle cx="190" cy="205" r="14" fill="#fff" stroke="var(--apex-navy)" strokeWidth="6" />
      </svg>
    </div>
  )
}
