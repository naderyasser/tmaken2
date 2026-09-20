'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MoreVertical } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useCompanySafe } from '@/hooks/use-company'
import { fmtDate } from '@/lib/hr-format'
import { getModuleConfig, type FieldDef, type ListModuleConfig } from '@/lib/hr-modules'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { ApexDatePicker, ApexTimePicker } from '@/components/hr/apex/date-picker'
import { AdvancedSearchDrawer, applyDrawer, type DrawerValues } from '@/components/hr/advanced-search-drawer'

type Row = Record<string, any> & { name: string }

const TABS: { id: string; label: string; module: string }[] = [
  { id: 'leaves', label: 'الاجازات', module: 'add-leave' },
  { id: 'permissions', label: 'الاذونات', module: 'add-permission' },
  { id: 'fingerprints', label: 'البصمات', module: 'fingerprint-requests' },
]
const PAGE_SIZES = [5, 10, 20, 50]

const HR_REQUEST_METHOD = {
  approve: 'base_meena.api.hr_requests.approve_request',
  reject: 'base_meena.api.hr_requests.reject_request',
  cancel: 'base_meena.api.hr_requests.cancel_request',
} as const

const VALUE_AR: Record<string, string> = {
  Approved: 'معتمد', Rejected: 'مرفوض', Draft: 'مسودة', Pending: 'قيد الانتظار', Cancelled: 'ملغي',
  'Work From Home': 'عمل من المنزل', 'On Duty': 'مهمة عمل',
}
const ar = (v: any) => (typeof v === 'string' && VALUE_AR[v]) || v

function DocBadge({ row }: { row: Row }) {
  const ds = Number(row.docstatus ?? 0)
  let label = 'مسودة'
  let cls = 'bg-slate-100 text-slate-600'
  if (ds === 2) { label = 'ملغي'; cls = 'bg-slate-200 text-slate-500' }
  else if (row.status === 'Rejected') { label = 'مرفوض'; cls = 'bg-red-100 text-red-700' }
  else if (ds === 1 || row.status === 'Approved') { label = 'معتمد'; cls = 'bg-emerald-100 text-emerald-700' }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold', cls)}>{label}</span>
}

function cellValue(f: FieldDef, row: Row) {
  if (f.statusBadge) return <DocBadge row={row} />
  if (f.type === 'date') return fmtDate(row[f.field])
  if (f.type === 'checkbox') return row[f.field] ? 'نعم' : 'لا'
  return ar(row[f.field]) || (f.fallbackField ? row[f.fallbackField] : undefined) || '—'
}

interface EmployeeOpt { name: string; employee_name: string; employee_number?: string }
const EMP_FIELD = 'h-[40px] w-full rounded border border-[var(--apex-border)] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

/** الموظف* autocomplete showing «name - code» (G4/G5). */
function EmployeeAutocomplete({ options, query, onQuery, onSelect }: {
  options: EmployeeOpt[]; query: string; onQuery: (v: string) => void; onSelect: (emp: EmployeeOpt) => void
}) {
  const [open, setOpen] = useState(false)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((o) =>
        o.employee_name?.toLowerCase().includes(q) ||
        String(o.employee_number ?? '').toLowerCase().includes(q) ||
        o.name?.toLowerCase().includes(q))
    : options
  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { onQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="اسم أو كود الموظف"
        className={EMP_FIELD}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg text-[13px]">
          {filtered.slice(0, 50).map((o) => (
            <li key={o.name}>
              <button type="button" onMouseDown={() => { onSelect(o); setOpen(false) }} className="block w-full text-right px-3 py-2 hover:bg-slate-50">
                {o.employee_name}{o.employee_number ? ` - ${o.employee_number}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

async function fetchRows(cfg: ListModuleConfig): Promise<Row[]> {
  let list: Row[]
  if (cfg.method) {
    const r: any = await frappeClient.call<Row[]>(cfg.method, cfg.methodArgs)
    list = Array.isArray(r?.message) ? r.message : []
  } else {
    const fieldNames = Array.from(new Set([...cfg.fields.map((f) => f.field), 'name']))
    list = await frappeClient.getList<Row>(cfg.doctype, { fields: fieldNames, filters: cfg.filters, order_by: cfg.orderBy, limit_page_length: 0 })
  }
  if (cfg.deriveFields) for (const row of list) for (const d of cfg.deriveFields) row[d.as] = d.from(row)
  return list
}

/**
 * «الطلبات» (5.14) — Apex tabs (الاجازات · الاذونات · البصمات) sit BELOW an
 * Apex toolbar (اضافة اجازة · حذف · الطباعة · filter · search), each tab its
 * own ApexTableCard/ApexPagination. Per-row اعتماد/رفض/إلغاء stays in the ⋮
 * menu as before (X, acceptable per the gap report) — the rebuild here is the
 * toolbar/tabs shell and the G4/G5 add dialogs. Independent of
 * generic-list-page.tsx (not this batch's file) so its own toolbar rework
 * elsewhere can't collide with this page.
 */
export function RequestsTabsPage() {
  const { toast } = useToast()
  const { company } = useCompanySafe()
  const [tab, setTab] = useState(TABS[0].id)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const [drawer, setDrawer] = useState<DrawerValues>({})
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [employees, setEmployees] = useState<EmployeeOpt[]>([])
  const [leaveTypes, setLeaveTypes] = useState<{ name: string; leave_type_name: string }[]>([])

  const activeTabDef = TABS.find((t) => t.id === tab)!
  const cfg = getModuleConfig(activeTabDef.module) as ListModuleConfig

  const refreshCounts = useCallback(() => {
    TABS.forEach((t) => {
      const c = getModuleConfig(t.module) as ListModuleConfig | undefined
      if (!c) return
      frappeClient.call<number>('frappe.client.get_count', { doctype: c.doctype, filters: c.filters ?? {} })
        .then((r: any) => setCounts((prev) => ({ ...prev, [t.id]: Number(r?.message ?? 0) })))
        .catch(() => {})
    })
  }, [])
  useEffect(() => { refreshCounts() }, [refreshCounts])

  useEffect(() => {
    frappeClient.getList<EmployeeOpt>('Employee', {
      fields: ['name', 'employee_name', 'employee_number'], filters: [['status', '=', 'Active']],
      order_by: 'employee_name asc', limit_page_length: 0,
    }).then(setEmployees).catch(() => setEmployees([]))
    frappeClient.getList<{ name: string; leave_type_name: string }>('Leave Type', {
      fields: ['name', 'leave_type_name'], order_by: 'leave_type_name asc', limit_page_length: 0,
    }).then(setLeaveTypes).catch(() => setLeaveTypes([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await fetchRows(cfg))
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل الطلبات', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [cfg, toast])
  useEffect(() => { setSelected(new Set()); setPage(1); setSearch(''); setDrawer({}); load() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const tableFields = useMemo(() => cfg.fields.filter((f) => f.inTable !== false), [cfg])

  const filtered = useMemo(() => {
    const base = cfg.drawerFilters ? applyDrawer(rows, cfg.drawerFilters, drawer) : rows
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter((r) => tableFields.some((f) => String(r[f.field] ?? '').toLowerCase().includes(q)))
  }, [rows, search, drawer, cfg, tableFields])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.name))
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev)
    if (allChecked) pageRows.forEach((r) => next.delete(r.name)); else pageRows.forEach((r) => next.add(r.name))
    return next
  })
  const toggleOne = (name: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  const requestAction = async (action: 'approve' | 'reject' | 'cancel', row: Row) => {
    try {
      await frappeClient.call(HR_REQUEST_METHOD[action], { doctype: cfg.doctype, name: row.name })
      toast({ title: action === 'approve' ? 'تم الاعتماد' : action === 'reject' ? 'تم الرفض' : 'تم الإلغاء' })
      refreshCounts(); load()
    } catch (e: any) {
      toast({ title: 'فشلت العملية', description: e?.message, variant: 'destructive' })
    }
  }

  const confirmBulkDelete = async () => {
    setDeleting(true)
    let ok = 0, failed = 0
    for (const name of selected) {
      try { await frappeClient.call(HR_REQUEST_METHOD.cancel, { doctype: cfg.doctype, name }); ok++ } catch { failed++ }
    }
    setDeleting(false); setBulkDeleteOpen(false); setSelected(new Set())
    toast({ title: `تم حذف ${ok}`, description: failed ? `تعذّر حذف ${failed}` : undefined, variant: failed ? 'destructive' : undefined })
    refreshCounts(); load()
  }

  // ── add dialog state (shape differs per tab — G4 leave / G5 permission / fingerprint) ──
  const [empQuery, setEmpQuery] = useState('')
  const [leaveForm, setLeaveForm] = useState({ employee: '', leave_type: '', from_date: '', to_date: '', description: '' })
  const [permForm, setPermForm] = useState({ employee: '', permission_date: '', from_time: '', to_time: '', reason: '' })
  const [fpForm, setFpForm] = useState({ employee: '', from_date: '', to_date: '', reason: 'Work From Home', explanation: '' })

  const resetAddForms = () => {
    setEmpQuery('')
    setLeaveForm({ employee: '', leave_type: '', from_date: '', to_date: '', description: '' })
    setPermForm({ employee: '', permission_date: '', from_time: '', to_time: '', reason: '' })
    setFpForm({ employee: '', from_date: '', to_date: '', reason: 'Work From Home', explanation: '' })
  }
  const openAdd = () => { resetAddForms(); setAddOpen(true) }

  const withCompany = (payload: Record<string, any>) => {
    if (cfg.needsCompany && !payload.company) return { ...payload, company: company || undefined }
    return payload
  }

  const submitAdd = async () => {
    if (!cfg.createMethod) return
    setSaving(true)
    try {
      if (tab === 'leaves') {
        if (!leaveForm.employee || !leaveForm.leave_type || !leaveForm.from_date || !leaveForm.to_date) {
          toast({ title: 'أكمل الحقول المطلوبة', variant: 'destructive' }); setSaving(false); return
        }
        await frappeClient.call(cfg.createMethod, withCompany(leaveForm))
      } else if (tab === 'permissions') {
        if (!permForm.employee || !permForm.permission_date || !permForm.from_time || !permForm.to_time || !permForm.reason) {
          toast({ title: 'أكمل الحقول المطلوبة', variant: 'destructive' }); setSaving(false); return
        }
        const values = cfg.mapCreatePayload ? cfg.mapCreatePayload(withCompany(permForm)) : permForm
        await frappeClient.call(cfg.createMethod, values)
      } else {
        if (!fpForm.employee || !fpForm.from_date || !fpForm.to_date || !fpForm.reason) {
          toast({ title: 'أكمل الحقول المطلوبة', variant: 'destructive' }); setSaving(false); return
        }
        const values = cfg.mapCreatePayload ? cfg.mapCreatePayload(withCompany(fpForm)) : fpForm
        await frappeClient.call(cfg.createMethod, values)
      }
      toast({ title: 'تمت الإضافة' })
      setAddOpen(false)
      refreshCounts(); load()
    } catch (e: any) {
      toast({ title: 'فشلت الإضافة', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div dir="rtl" className="p-4 font-[family-name:var(--font-arabic)]">
      <ApexToolbar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: cfg.searchPlaceholder || 'ابحث' }}
        onFilter={cfg.drawerFilters ? () => setShowFilter(true) : undefined}
        print={{ onPrint: () => window.print(), onAdvancedPrint: () => window.print() }}
        deleteButton={{ onClick: () => setBulkDeleteOpen(true), disabled: selected.size === 0 }}
        add={{ label: cfg.addLabel || 'اضافة', onClick: openAdd }}
      />

      {/* tabs BELOW the toolbar — green circular badges, green underline on the active tab */}
      <div className="mt-2 border-b border-slate-200">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'relative px-6 h-[54px] text-[15px] font-bold flex items-center gap-2 transition-colors',
                tab === t.id ? 'text-[var(--apex-green)]' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <span>{t.label}</span>
              <span className={cn('min-w-[22px] h-[22px] rounded-full text-white text-[12px] flex items-center justify-center px-1',
                tab === t.id ? 'bg-[var(--apex-green)]' : 'bg-slate-400')}>{counts[t.id] ?? 0}</span>
              {tab === t.id && <span className="absolute bottom-0 right-0 left-0 h-[3px] bg-[var(--apex-green)]" />}
            </button>
          ))}
        </div>
      </div>

      <ApexTableCard>
        <table className="apex-table w-full">
          <thead>
            <tr>
              <th className="text-center w-10">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-[var(--apex-green)]" aria-label="تحديد الكل" />
              </th>
              {tableFields.map((f) => <th key={f.field}>{f.label}</th>)}
              <th className="text-center w-12">اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={tableFields.length + 2} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={tableFields.length + 2} className="py-10 text-center text-slate-500">لا يوجد نتائج للبحث ابحث مرة اخري</td></tr>
            ) : pageRows.map((row) => (
              <tr key={row.name}>
                <td className="text-center">
                  <input type="checkbox" checked={selected.has(row.name)} onChange={() => toggleOne(row.name)} className="h-4 w-4 accent-[var(--apex-green)]" />
                </td>
                {tableFields.map((f) => <td key={f.field}>{cellValue(f, row)}</td>)}
                <td className="text-center">
                  <DropdownMenu dir="rtl">
                    <DropdownMenuTrigger asChild>
                      <button title="خيارات" aria-label="خيارات" className="text-slate-500 hover:text-slate-700 px-1"><MoreVertical className="h-[18px] w-[18px]" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-[13px] min-w-[120px]">
                      <DropdownMenuItem onClick={() => requestAction('approve', row)}>اعتماد</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => requestAction('reject', row)}>رفض</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => requestAction('cancel', row)} className="text-red-600 focus:text-red-600">إلغاء</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ApexTableCard>

      <ApexPagination
        page={currentPage} pageCount={totalPages} pageSize={pageSize} total={filtered.length}
        onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
      />

      {cfg.drawerFilters && (
        <AdvancedSearchDrawer
          open={showFilter} onClose={() => setShowFilter(false)}
          filters={cfg.drawerFilters} values={drawer} onApply={(v) => { setDrawer(v); setShowFilter(false); setPage(1) }}
        />
      )}

      {/* G4 — اضافة اجازة (title as measured live, incl. the duplicated «اضافة») */}
      {tab === 'leaves' && (
        <ApexDialog open={addOpen} onOpenChange={setAddOpen} title="اضافة اضافة اجازة" size="lg" primary={{ label: 'اضافة', onClick: submitAdd, loading: saving }}>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">الموظف <span className="text-red-500">*</span></label>
            <EmployeeAutocomplete
              options={employees} query={empQuery}
              onQuery={(v) => { setEmpQuery(v); setLeaveForm((f) => ({ ...f, employee: '' })) }}
              onSelect={(emp) => { setEmpQuery(`${emp.employee_name}${emp.employee_number ? ` - ${emp.employee_number}` : ''}`); setLeaveForm((f) => ({ ...f, employee: emp.name })) }}
            />
          </div>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">نوع الاجازة <span className="text-red-500">*</span></label>
            <select value={leaveForm.leave_type} onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))} className={EMP_FIELD}>
              <option value="">اختر…</option>
              {leaveTypes.map((lt) => <option key={lt.name} value={lt.name}>{lt.leave_type_name || lt.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">من تاريخ <span className="text-red-500">*</span></label>
            <ApexDatePicker value={leaveForm.from_date} onChange={(v) => setLeaveForm((f) => ({ ...f, from_date: v }))} />
          </div>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">إلى تاريخ <span className="text-red-500">*</span></label>
            <ApexDatePicker value={leaveForm.to_date} onChange={(v) => setLeaveForm((f) => ({ ...f, to_date: v }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-[13px] text-slate-700 mb-1">ملاحظات</label>
            <textarea value={leaveForm.description} onChange={(e) => setLeaveForm((f) => ({ ...f, description: e.target.value }))} rows={3}
              className="w-full rounded border border-[var(--apex-border)] bg-white px-2.5 py-2 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]" />
          </div>
        </ApexDialog>
      )}

      {/* G5 — اضافة اذن: starts with الموظف* + التاريخ only, rest appears after an employee is chosen */}
      {tab === 'permissions' && (
        <ApexDialog open={addOpen} onOpenChange={setAddOpen} title={cfg.addLabel || 'اضافة اذن'} size="lg" primary={{ label: 'اضافة', onClick: submitAdd, loading: saving }}>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">الموظف <span className="text-red-500">*</span></label>
            <EmployeeAutocomplete
              options={employees} query={empQuery}
              onQuery={(v) => { setEmpQuery(v); setPermForm((f) => ({ ...f, employee: '' })) }}
              onSelect={(emp) => { setEmpQuery(`${emp.employee_name}${emp.employee_number ? ` - ${emp.employee_number}` : ''}`); setPermForm((f) => ({ ...f, employee: emp.name })) }}
            />
          </div>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">التاريخ</label>
            <ApexDatePicker value={permForm.permission_date} onChange={(v) => setPermForm((f) => ({ ...f, permission_date: v }))} />
          </div>
          {permForm.employee && (
            <>
              <div>
                <label className="block text-[13px] text-slate-700 mb-1">من الساعة <span className="text-red-500">*</span></label>
                <ApexTimePicker value={permForm.from_time} onChange={(v) => setPermForm((f) => ({ ...f, from_time: v }))} />
              </div>
              <div>
                <label className="block text-[13px] text-slate-700 mb-1">إلى الساعة <span className="text-red-500">*</span></label>
                <ApexTimePicker value={permForm.to_time} onChange={(v) => setPermForm((f) => ({ ...f, to_time: v }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-[13px] text-slate-700 mb-1">السبب <span className="text-red-500">*</span></label>
                <textarea value={permForm.reason} onChange={(e) => setPermForm((f) => ({ ...f, reason: e.target.value }))} rows={3}
                  className="w-full rounded border border-[var(--apex-border)] bg-white px-2.5 py-2 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]" />
              </div>
            </>
          )}
        </ApexDialog>
      )}

      {/* fingerprint tab — no Apex measurement given, kept simple but on the same dialog frame */}
      {tab === 'fingerprints' && (
        <ApexDialog open={addOpen} onOpenChange={setAddOpen} title={cfg.addLabel || 'اضافة طلب بصمة'} size="lg" primary={{ label: 'اضافة', onClick: submitAdd, loading: saving }}>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">الموظف <span className="text-red-500">*</span></label>
            <EmployeeAutocomplete
              options={employees} query={empQuery}
              onQuery={(v) => { setEmpQuery(v); setFpForm((f) => ({ ...f, employee: '' })) }}
              onSelect={(emp) => { setEmpQuery(`${emp.employee_name}${emp.employee_number ? ` - ${emp.employee_number}` : ''}`); setFpForm((f) => ({ ...f, employee: emp.name })) }}
            />
          </div>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">السبب <span className="text-red-500">*</span></label>
            <select value={fpForm.reason} onChange={(e) => setFpForm((f) => ({ ...f, reason: e.target.value }))} className={EMP_FIELD}>
              <option value="Work From Home">عمل من المنزل</option>
              <option value="On Duty">مهمة عمل</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">من تاريخ <span className="text-red-500">*</span></label>
            <ApexDatePicker value={fpForm.from_date} onChange={(v) => setFpForm((f) => ({ ...f, from_date: v }))} />
          </div>
          <div>
            <label className="block text-[13px] text-slate-700 mb-1">إلى تاريخ <span className="text-red-500">*</span></label>
            <ApexDatePicker value={fpForm.to_date} onChange={(v) => setFpForm((f) => ({ ...f, to_date: v }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-[13px] text-slate-700 mb-1">التفاصيل</label>
            <textarea value={fpForm.explanation} onChange={(e) => setFpForm((f) => ({ ...f, explanation: e.target.value }))} rows={3}
              className="w-full rounded border border-[var(--apex-border)] bg-white px-2.5 py-2 text-[13px] text-slate-800 outline-none focus:border-[var(--apex-blue)]" />
          </div>
        </ApexDialog>
      )}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="حذف الطلبات المحددة؟"
        description={`سيتم إلغاء/حذف ${selected.size} طلب.`}
        confirmLabel="حذف"
        onConfirm={confirmBulkDelete}
        loading={deleting}
      />
    </div>
  )
}
