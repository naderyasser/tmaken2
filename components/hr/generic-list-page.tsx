'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, MoreVertical, AlertCircle } from 'lucide-react'
import { frappeClient, isAuthError } from '@/lib/api-client'
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/hr-format'
import { SessionRenew } from '@/components/login-page'
import { useAuthSafe } from '@/lib/auth-context'
import { useCompanySafe } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FieldInput, toFormValue, toPayload } from '@/components/hr/field-input'
import type { FieldDef, ListModuleConfig } from '@/lib/hr-modules'
import { VALUE_AR } from '@/lib/enums'
import { ApexEmptyState, BoxIllustration } from '@/components/hr/apex-empty-state'
import { AdvancedSearchDrawer, applyDrawer, type DrawerValues } from '@/components/hr/advanced-search-drawer'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { PrintDialog } from '@/components/hr/apex/print-dialog'
import { RowMenu } from '@/components/hr/apex/row-menu'
import { ViewRecordDialog } from '@/components/hr/apex/view-record-dialog'
import { VersionLogDialog } from '@/components/hr/apex/version-log-dialog'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'

type Row = Record<string, any> & { name: string }

const PAGE_SIZES = [5, 10, 25, 50, 100]

/** Arabic labels for the Frappe status values that show up in list cells
 *  (defined in lib/enums.ts so lib/hr-modules.ts field configs can reuse the
 *  same map as `optionLabels`). */
const ar = (v: any) => (typeof v === 'string' && VALUE_AR[v]) || v

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/

/** Dotted paths for the three submittable-request actions (row menu, bulk
 *  «تنشيط ▾», and — once wired — the print/report surfaces), kept in one
 *  place so a backend rename only needs one edit. */
const HR_REQUEST_METHOD = {
  approve: 'base_meena.api.hr_requests.approve_request',
  reject: 'base_meena.api.hr_requests.reject_request',
  cancel: 'base_meena.api.hr_requests.cancel_request',
} as const

/** Apex doc-lifecycle label for a `statusBadge` column: مسودة / معتمد / مرفوض
 *  / ملغي, derived from `docstatus` (+ `status` when the doctype carries one). */
function docBadgeLabel(row: Row): string {
  const ds = Number(row.docstatus ?? 0)
  if (ds === 2) return 'ملغي'
  if (row.status === 'Rejected') return 'مرفوض'
  if (ds === 1 || row.status === 'Approved') return 'معتمد'
  return 'مسودة'
}
function DocBadge({ row }: { row: Row }) {
  const label = docBadgeLabel(row)
  const cls = label === 'ملغي' ? 'bg-slate-200 text-slate-500'
    : label === 'مرفوض' ? 'bg-red-100 text-red-700'
    : label === 'معتمد' ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>
}

/** Plain-text cell value — shared by the interactive table, the print-only
 *  table, CSV export and the «عرض» view dialog, so none of them can drift on
 *  how a value is displayed. Formats every date/datetime as `dd/mm/yyyy`
 *  (`dd/mm/yyyy HH:mm` for datetimes), whether the field is explicitly typed
 *  `date`/`time` or just happens to hold an ISO-looking string (B10). */
function cellText(f: FieldDef, row: Row): string {
  if (f.statusBadge) return docBadgeLabel(row)
  if (f.statusDot) return row[f.field] === f.statusDot.on ? (f.statusDot.onLabel || 'نشط') : (f.statusDot.offLabel || 'غير نشط')
  if (f.type === 'checkbox') return row[f.field] ? 'نعم' : 'لا'
  const raw = row[f.field]
  if (f.type === 'date') return raw ? fmtDate(raw) : (f.fallbackField && row[f.fallbackField]) || '—'
  if (f.type === 'time') return raw ? fmtTime(raw) : '—'
  if (typeof raw === 'string') {
    if (ISO_DATE.test(raw)) return fmtDate(raw)
    if (ISO_DATETIME.test(raw)) return fmtDateTime(raw)
  }
  const val = ar(raw)
  if (val !== undefined && val !== null && val !== '') return String(val)
  if (f.fallbackField && row[f.fallbackField]) return String(row[f.fallbackField])
  return '—'
}

/** Rendered cell — `cellText` plus the coloured status-dot markup. */
function cellValue(f: FieldDef, row: Row): ReactNode {
  if (f.statusBadge) return <DocBadge row={row} />
  if (f.statusDot) {
    const on = row[f.field] === f.statusDot.on
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${on ? 'bg-[var(--apex-green)]' : 'bg-slate-400'}`} />
        {on ? (f.statusDot.onLabel || 'نشط') : (f.statusDot.offLabel || 'غير نشط')}
      </span>
    )
  }
  return cellText(f, row)
}

/**
 * Apex list screen — bare toolbar (search · filter · الطباعة · الاجراءات ·
 * اضافة, RTL) ABOVE a white table card (☐ · م · data · إجراءات) → pagination
 * (rows · page numbers · go-to-page). See components/hr/apex/* for the
 * shared pieces and apex/shared-components-contract.md for their shapes.
 */
export function GenericListPage({ config }: { config: ListModuleConfig }) {
  const { toast } = useToast()
  const router = useRouter()
  const { company } = useCompanySafe()
  const { isAuthenticated, isLoading: authLoading } = useAuthSafe()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const [drawer, setDrawer] = useState<DrawerValues>({})
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printRows, setPrintRows] = useState<Row[] | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [bulkDelete, setBulkDelete] = useState(false)
  const [viewRow, setViewRow] = useState<Row | null>(null)
  const [historyRow, setHistoryRow] = useState<Row | null>(null)

  // Printing renders a dedicated print-only table (see the `hidden print:block`
  // block below) into `printRows`, then calls window.print(); once the print
  // dialog closes (or is cancelled) we restore the normal screen view.
  useEffect(() => {
    const restore = () => setPrintRows(null)
    window.addEventListener('afterprint', restore)
    return () => window.removeEventListener('afterprint', restore)
  }, [])

  const tableFields = useMemo(() => config.fields.filter((f) => f.inTable !== false), [config.fields])
  const formFields = useMemo(() => config.fields.filter((f) => f.inForm !== false), [config.fields])
  /** All "visible" fields (table and/or form) — used by the «عرض» dialog so
   *  it shows the full record, not just the table's narrower column set. */
  const viewFields = useMemo(() => config.fields.filter((f) => f.inTable !== false || f.inForm !== false), [config.fields])

  const load = useCallback(async () => {
    // No session yet — don't fire the request; <SessionRenew /> reopens it.
    if (!authLoading && !isAuthenticated) {
      setRows([])
      setAuthRequired(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    setAuthRequired(false)
    try {
      // Derived fields (config.deriveFields' `as` names, e.g. `_status_label`)
      // are computed client-side after the fetch — they are never real
      // columns, so they must never be requested here (a plain getList would
      // 417 with "Field not permitted in query", which `isAuthError` below
      // then misreads as a permission error because Frappe's message text
      // happens to contain "not permitted").
      const derivedNames = new Set((config.deriveFields ?? []).map((d) => d.as))
      // A field's own `fallbackField` (e.g. employees' `custom_shift_label` falling
      // back to `default_shift`, Opus review round 2 APEX PARITY item) must be
      // fetched too, or the fallback — and any drawerFilters entry over that same
      // underlying field — silently has no data to read. Previously this only
      // "worked" for the one pre-existing fallbackField user (`name`) by
      // coincidence, since `name` was already hardcoded into this list below.
      const fieldNames = Array.from(new Set([
        ...config.fields.map((f) => f.field),
        ...config.fields.map((f) => f.fallbackField).filter((f): f is string => !!f),
        'name',
      ])).filter((name) => !derivedNames.has(name))
      const data = config.method
        ? ((await frappeClient.call<Row[]>(config.method, config.methodArgs)) as any)?.message ?? []
        : await frappeClient.getList<Row>(config.doctype, {
          fields: fieldNames,
          filters: config.filters,
          order_by: config.orderBy,
          limit_page_length: 0,
        })
      const list: Row[] = Array.isArray(data) ? data : []
      if (config.deriveFields) {
        for (const row of list) for (const d of config.deriveFields) row[d.as] = d.from(row)
      }
      setRows(list)
    } catch (e) {
      if (isAuthError(e)) {
        setRows([])
        setAuthRequired(true)
        setLoadError(false)
      } else {
        console.error(`Failed to load ${config.doctype}:`, e)
        setRows([])
        setLoadError(true)
        toast({ title: 'تعذّر تحميل البيانات', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [config.doctype, config.method, config.methodArgs, config.fields, config.filters, config.orderBy, config.deriveFields, authLoading, isAuthenticated, toast])

  useEffect(() => { if (!authLoading) load() }, [load, authLoading])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = config.drawerFilters ? applyDrawer(rows, config.drawerFilters, drawer) : rows
    if (!q) return base
    // Over ALL configured fields, not just table columns — a raw field
    // hidden from the table in favour of a translated column (e.g. Leave
    // Type's English name behind `_label`, or Country's `country_name`
    // behind `_name_ar`) must still be searchable, so a user typing either
    // language still finds the row.
    return base.filter((r) => config.fields.some((f) => String(r[f.field] ?? '').toLowerCase().includes(q)))
  }, [rows, search, config.fields, config.drawerFilters, drawer])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.name))

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) pageRows.forEach((r) => next.delete(r.name))
      else pageRows.forEach((r) => next.add(r.name))
      return next
    })
  }
  const toggleOne = (name: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  const bulkActive = async (on: boolean) => {
    if (!config.active) return
    if (config.requestActions) {
      // Submittable HR request docs: «تنشيط» = approve (submit), «إلغاء
      // التنشيط» = cancel — never a raw field toggle.
      const method = on ? HR_REQUEST_METHOD.approve : HR_REQUEST_METHOD.cancel
      let ok = 0
      for (const name of selected) {
        try { await frappeClient.call(method, { doctype: config.doctype, name }); ok++ } catch { /* keep going */ }
      }
      toast({ title: on ? `تم اعتماد ${ok} طلب` : `تم إلغاء ${ok} طلب` })
      setSelected(new Set())
      load()
      return
    }
    try {
      await frappeClient.call('base_meena.api.hr_lists.set_active', {
        doctype: config.doctype, names: Array.from(selected), active: on,
      })
      toast({ title: on ? `تم تنشيط ${selected.size}` : `تم إلغاء تنشيط ${selected.size}` })
    } catch (e) {
      toast({ title: 'فشلت العملية', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    }
    setSelected(new Set())
    load()
  }

  /** Per-row تنشيط/إلغاء التنشيط (RowMenu, kind='employee'). */
  const setRowActive = async (row: Row, on: boolean) => {
    if (!config.active) return
    try {
      await frappeClient.call('base_meena.api.hr_lists.set_active', {
        doctype: config.doctype, names: [row.name], active: on,
      })
      toast({ title: on ? 'تم التنشيط' : 'تم إلغاء التنشيط' })
      load()
    } catch (e) {
      toast({ title: 'فشلت العملية', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    }
  }

  /** Per-row اعتماد / رفض / إلغاء — only offered when config.requestActions.
   *  `message.already` (approve_request/reject_request already found the doc
   *  in that state, e.g. a stale ⋮ menu) means nothing actually changed — say
   *  so instead of the normal success toast. */
  const requestAction = async (action: 'approve' | 'reject' | 'cancel', row: Row) => {
    const method = HR_REQUEST_METHOD[action]
    try {
      const res = await frappeClient.call(method, { doctype: config.doctype, name: row.name })
      const already = (res as any)?.message?.already === true
      const title = already
        ? (action === 'approve' ? 'الطلب معتمد مسبقاً' : 'الطلب مرفوض مسبقاً')
        : (action === 'approve' ? 'تم الاعتماد' : action === 'reject' ? 'تم الرفض' : 'تم الإلغاء')
      toast({ title })
      load()
    } catch (e) {
      toast({ title: 'فشلت العملية', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    }
  }

  const confirmBulkDelete = async () => {
    setDeleting(true)
    let ok = 0, failed = 0
    for (const name of selected) {
      try {
        if (config.deleteMethod) await frappeClient.call(config.deleteMethod, { [config.deleteArgField || 'name']: name })
        else await frappeClient.delete(config.doctype, name)
        ok++
      } catch { failed++ }
    }
    setDeleting(false)
    setBulkDelete(false)
    setSelected(new Set())
    toast({ title: `تم حذف ${ok}`, description: failed ? `تعذّر حذف ${failed}` : undefined, variant: failed ? 'destructive' : undefined })
    load()
  }

  /** Fields actually live on the dialog for the given mode — `createOnly`
   *  fields (a one-time password, a role picker) never show up on edit. */
  const fieldsFor = (isEdit: boolean) => formFields.filter((f) => !(isEdit && f.createOnly))

  const openAdd = () => {
    if (config.addHref) { router.push(config.addHref); return }
    const initial: Record<string, any> = {}
    for (const f of fieldsFor(false)) initial[f.field] = f.type === 'checkbox' ? false : ''
    setEditing(null)
    setForm(initial)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const openEdit = (row: Row) => {
    if (config.editHref) { router.push(config.editHref(row.name)); return }
    const initial: Record<string, any> = {}
    for (const f of fieldsFor(true)) initial[f.field] = toFormValue(f, row[f.field])
    setEditing(row)
    setForm(initial)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const save = async () => {
    const isEdit = !!editing
    const activeFields = fieldsFor(isEdit)
    const errors: Record<string, string> = {}
    for (const f of activeFields) {
      if (f.required && !String(form[f.field] ?? '').trim()) errors[f.field] = 'هذا الحقل مطلوب'
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      const firstLabel = activeFields.find((f) => errors[f.field])?.label
      toast({ title: 'حقل مطلوب', description: firstLabel, variant: 'destructive' })
      return
    }
    setFieldErrors({})
    // `lockedOnEdit` fields (e.g. email) are shown disabled for context but
    // never sent back on PUT — the value on screen is already the row's own.
    const payloadFields = activeFields.filter((f) => !(isEdit && f.lockedOnEdit))
    let payload = toPayload(payloadFields, form)
    if (!isEdit && config.needsCompany && !payload.company) payload.company = company || undefined
    if (!isEdit && config.mapCreatePayload) payload = config.mapCreatePayload(payload)
    setSaving(true)
    try {
      let createResult: any
      if (editing) {
        // Changing the doctype's autoname-source field via a plain PUT is a
        // silent no-op in Frappe (200 OK, field unchanged — see nameField's
        // doc comment). Rename first, then PUT whatever else changed under
        // the new name.
        const newName = config.nameField ? String(payload[config.nameField] ?? '').trim() : ''
        if (newName && newName !== editing.name) {
          await frappeClient.call('frappe.client.rename_doc', { doctype: config.doctype, old_name: editing.name, new_name: newName })
          const rest = { ...payload }
          delete rest[config.nameField as string]
          if (Object.keys(rest).length) await frappeClient.put(config.doctype, newName, rest)
        } else {
          await frappeClient.put(config.doctype, editing.name, payload)
        }
      }
      else if (config.createMethod) createResult = (await frappeClient.call(config.createMethod, payload) as any)?.message
      else await frappeClient.post(config.doctype, payload)
      toast({
        title: editing ? 'تم التحديث' : 'تمت الإضافة',
        description: createResult?.server_ip
          ? `اضبط الجهاز الفعلي على: ${createResult.server_ip}:${createResult.server_port} (HTTP)`
          : undefined,
      })
      setDialogOpen(false)
      await load()
    } catch (e) {
      // A few core Frappe doctypes (Country among them) have renaming
      // disabled outright (`allow_rename: 0`) — a correct rejection, but its
      // message is raw English like every other core exception; wrap the one
      // we can identify by text so it reads Arabic like the rest of the app.
      const raw = e instanceof Error ? e.message : ''
      const description = raw.includes('not allowed to be renamed')
        ? 'لا يمكن تغيير اسم هذا العنصر — يمكنك تعديل الحقول الأخرى فقط'
        : raw || 'تعذّر الاتصال بالخادم'
      toast({ title: 'فشل الحفظ', description, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (config.deleteMethod) {
        await frappeClient.call(config.deleteMethod, { [config.deleteArgField || 'name']: deleteTarget.name })
      } else {
        await frappeClient.delete(config.doctype, deleteTarget.name)
      }
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      // Close the dialog on failure too — left open, its «سيتم حذف السجل…»
      // text reads like a success message and hides the error toast.
      setDeleteTarget(null)
      toast({ title: 'فشل الحذف', description: e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم', variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  /** «طباعة» prints every row matching the active search/drawer filters
   *  (already fully loaded — the list always fetches with no server-side
   *  limit, see load() above — so no extra round-trip is needed). Renders
   *  into the print-only table below, then triggers the browser print
   *  dialog; `afterprint` (registered above) restores the normal screen view. */
  const doPrint = () => {
    setPrintDialogOpen(false)
    setPrintRows(filtered)
    requestAnimationFrame(() => window.print())
  }

  const exportCsv = () => {
    const head = tableFields.map((f) => f.label)
    const lines = [head.join(',')]
    for (const row of filtered) {
      lines.push(tableFields.map((f) => `"${cellText(f, row).replace(/"/g, '""')}"`).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${config.title}.csv`
    a.click()
  }

  const colSpan = tableFields.length + (config.readOnly ? 0 : 1) + (config.noIndex ? 0 : 1) + 1
  const showChrome = loading || pageRows.length > 0
  const printTemplates = [{ key: 'default', label: config.title, isDefault: true }]

  return (
    <div dir="rtl" className="space-y-2 p-4 font-[family-name:var(--font-arabic)]">

      {config.noteBanner && (
        <div className="flex items-start gap-2 rounded bg-blue-50 border border-blue-200 px-3 py-2.5 text-[12.5px] text-blue-900 leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{config.noteBanner}</span>
        </div>
      )}

      {/* ── Print-only view: just the title, date and table (see app/globals.css
          for the rules that hide the sidebar/topbar around it) ── */}
      {printRows && (
        <div className="hidden print:block">
          <h1 className="text-lg font-bold mb-1">{config.title}</h1>
          <p className="text-xs text-slate-500 mb-4">{fmtDate(new Date())}</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {!config.noIndex && <th className="border border-slate-300 px-2 py-1 text-center">م</th>}
                {tableFields.map((f) => (
                  <th key={f.field} className="border border-slate-300 px-2 py-1 text-right">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printRows.map((row, i) => (
                <tr key={row.name}>
                  {!config.noIndex && <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>}
                  {tableFields.map((f) => (
                    <td key={f.field} className="border border-slate-300 px-2 py-1">
                      {cellText(f, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="print:hidden">
        <ApexToolbar
          search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: config.searchPlaceholder || 'ابحث بالاسم' }}
          onFilter={config.drawerFilters?.length ? () => setShowFilter(true) : undefined}
          print={config.print !== false ? { onPrint: doPrint, onAdvancedPrint: () => setPrintDialogOpen(true) } : undefined}
          actions={!config.readOnly && config.actionsMenu ? {
            disabled: selected.size === 0,
            items: [
              ...(config.active ? [
                { label: 'تنشيط', onSelect: () => bulkActive(true) },
                { label: 'إلغاء التنشيط', onSelect: () => bulkActive(false) },
              ] : []),
              { label: 'حذف', onSelect: () => setBulkDelete(true) },
            ],
          } : undefined}
          deleteButton={!config.readOnly && !config.actionsMenu ? { onClick: () => setBulkDelete(true), disabled: selected.size === 0 } : undefined}
          add={!config.readOnly && !config.noAdd ? { label: config.addLabel || 'اضافة', onClick: openAdd } : undefined}
        />
      </div>

      {authRequired && !loading && (
        <div className="print:hidden"><SessionRenew /></div>
      )}

      {loadError && !loading && (
        <div className="print:hidden flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>تعذّر تحميل البيانات من الخادم. تأكد من الاتصال ثم أعد المحاولة.</span>
        </div>
      )}

      <div className="print:hidden">
        {!showChrome ? (
          <ApexTableCard>
            <div className="py-6">
              {config.emptyText ? (
                <div className="flex flex-col items-center gap-6 py-6">
                  <BoxIllustration />
                  <p className="text-[18px] font-bold text-slate-800">{config.emptyText}</p>
                  {config.emptyAction && !config.readOnly && !config.noAdd && (
                    <button type="button" onClick={openAdd} className="h-[42px] px-5 rounded bg-[var(--apex-green)] text-white text-[15px] hover:bg-[var(--apex-green-dark)]">
                      {config.emptyAction}
                    </button>
                  )}
                </div>
              ) : (
                <ApexEmptyState />
              )}
            </div>
          </ApexTableCard>
        ) : (
          <>
            <ApexTableCard>
              <table className="apex-table">
                <thead>
                  <tr>
                    {!config.readOnly && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleAll}
                          className="h-4 w-4 cursor-pointer align-middle accent-[var(--apex-blue-light)]"
                          aria-label="تحديد الكل"
                        />
                      </th>
                    )}
                    {!config.noIndex && <th className="w-10 text-center">م</th>}
                    {tableFields.map((f) => <th key={f.field}>{f.label}</th>)}
                    <th className="apex-col-actions w-32">الاجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={colSpan} className="p-0"><TableSkeleton rows={6} cols={colSpan} /></td></tr>
                  ) : (
                    pageRows.map((row, i) => {
                      const canDelete = config.deletable ? config.deletable(row) : true
                      const isActive = config.active ? row[config.active.field] === config.active.on : undefined
                      // docstatus lifecycle for config.requestActions lists only
                      // (0 = مسودة, 1 = معتمد, 2 = ملغي) — drives which ⋮ menu
                      // items make sense (item 4, 2026-09-20 QA fix).
                      const ds = config.requestActions ? Number(row.docstatus ?? 0) : 0
                      const requestsLocked = !!config.requestActions && ds === 2
                      return (
                        <tr key={row.name}>
                          {!config.readOnly && (
                            <td>
                              <input
                                type="checkbox"
                                checked={selected.has(row.name)}
                                onChange={() => toggleOne(row.name)}
                                className="h-4 w-4 cursor-pointer align-middle accent-[var(--apex-blue-light)]"
                                aria-label={`تحديد ${row.name}`}
                              />
                            </td>
                          )}
                          {!config.noIndex && <td className="text-center text-slate-500">{(currentPage - 1) * pageSize + i + 1}</td>}
                          {tableFields.map((f) => (
                            <td key={f.field}>
                              {config.linkField === f.field && config.editHref ? (
                                <button type="button" onClick={() => openEdit(row)} className="apex-link hover:underline">{row[f.field] ?? '—'}</button>
                              ) : cellValue(f, row)}
                            </td>
                          ))}
                          <td className="apex-col-actions">
                            {/* Apex order (RTL, from the right): ✎ · 🗑 · ⋮ */}
                            <div className="flex items-center justify-center gap-1">
                              {!config.readOnly && (
                                <>
                                  <button onClick={() => openEdit(row)} title="تعديل" className="apex-icon-edit px-1 hover:opacity-75"><Pencil className="h-[17px] w-[17px]" /></button>
                                  <button
                                    onClick={() => canDelete && setDeleteTarget(row)}
                                    disabled={!canDelete}
                                    title="حذف"
                                    className={`apex-icon-delete px-1 ${canDelete ? 'hover:opacity-75' : 'is-disabled cursor-not-allowed'}`}
                                  >
                                    <Trash2 className="h-[17px] w-[17px]" />
                                  </button>
                                </>
                              )}
                              {config.rowMenu ? (
                                <RowMenu
                                  kind={config.rowMenu}
                                  onView={() => {
                                    // Employee «عرض» opens the dedicated Apex-style read-only
                                    // profile page instead of the generic field-dump dialog —
                                    // every other doctype keeps the generic dialog.
                                    if (config.doctype === 'Employee') router.push(`/employee-details/${row.name}`)
                                    else setViewRow(row)
                                  }}
                                  onHistory={config.rowMenu ? () => setHistoryRow(row) : undefined}
                                  isActive={isActive}
                                  onActivate={config.active ? () => setRowActive(row, true) : undefined}
                                  onDeactivate={config.active ? () => setRowActive(row, false) : undefined}
                                />
                              ) : (!config.readOnly || config.requestActions) && (
                                <DropdownMenu dir="rtl">
                                  <DropdownMenuTrigger asChild disabled={requestsLocked}>
                                    <button
                                      title={requestsLocked ? 'طلب ملغي' : 'خيارات'}
                                      aria-label="خيارات"
                                      disabled={requestsLocked}
                                      className={`apex-icon-more px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--apex-blue)] focus-visible:ring-offset-1 ${requestsLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                      <MoreVertical className="h-[18px] w-[18px]" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="text-[13px] min-w-[140px]">
                                    {/* A submitted request (ds 1) can neither be edited nor
                                        DELETEd in Frappe — it has to be cancelled (below) first,
                                        so both generic items only apply to drafts here. */}
                                    {!config.readOnly && ds === 0 && <DropdownMenuItem onClick={() => openEdit(row)}>تعديل</DropdownMenuItem>}
                                    {!config.readOnly && ds === 0 && (
                                      <DropdownMenuItem onClick={() => setDeleteTarget(row)} className="text-red-600 focus:text-red-600">حذف</DropdownMenuItem>
                                    )}
                                    {config.requestActions && (
                                      <>
                                        {ds === 0 && <DropdownMenuSeparator />}
                                        {ds === 0 && <DropdownMenuItem onClick={() => requestAction('approve', row)}>اعتماد</DropdownMenuItem>}
                                        {ds === 0 && <DropdownMenuItem onClick={() => requestAction('reject', row)}>رفض</DropdownMenuItem>}
                                        {ds === 1 && (
                                          <DropdownMenuItem onClick={() => requestAction('cancel', row)} className="text-red-600 focus:text-red-600">إلغاء</DropdownMenuItem>
                                        )}
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </ApexTableCard>

            <ApexPagination
              page={currentPage}
              pageCount={totalPages}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
            />
          </>
        )}
      </div>

      {/* Add / Edit dialog */}
      <ApexDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? `تعديل ${config.title}` : (config.addLabel || `اضافة ${config.title}`)}
        size="lg"
        primary={{ label: editing ? 'تعديل' : 'اضافة', onClick: save, disabled: saving, loading: saving }}
      >
        {fieldsFor(!!editing).map((f) => (
          <div key={f.field} className={f.type === 'textarea' ? 'col-span-2' : undefined}>
            {f.type !== 'checkbox' && (
              <Label className="text-[13px] text-slate-600 block mb-1.5">
                {f.label}{f.required && <span className="text-red-500"> *</span>}
              </Label>
            )}
            {editing && f.lockedOnEdit ? (
              <Input value={form[f.field] ?? ''} disabled className="rounded-sm border-slate-300 text-right bg-slate-50 text-slate-500" />
            ) : (
              <FieldInput
                field={f}
                value={form[f.field]}
                error={fieldErrors[f.field]}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, [f.field]: v }))
                  setFieldErrors((prev) => (prev[f.field] ? { ...prev, [f.field]: '' } : prev))
                }}
              />
            )}
            {f.hint && <p className="text-[11px] text-slate-400 mt-1 leading-[16px]">{f.hint}</p>}
          </div>
        ))}
      </ApexDialog>

      <PrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        templates={printTemplates}
        storageKey={config.title}
        onPrint={doPrint}
        onExport={(o) => { if (o.format === 'excel') exportCsv(); else doPrint() }}
      />

      {viewRow && (
        <ViewRecordDialog
          open={!!viewRow}
          onOpenChange={(o) => { if (!o) setViewRow(null) }}
          title={config.title}
          fields={viewFields.map((f) => ({ label: f.label, value: cellValue(f, viewRow) }))}
        />
      )}

      {config.rowMenu && (
        <VersionLogDialog
          open={!!historyRow}
          onOpenChange={(o) => { if (!o) setHistoryRow(null) }}
          doctype={config.doctype}
          name={historyRow?.name ?? null}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="تأكيد الحذف"
        description={deleteTarget ? `سيتم حذف السجل "${deleteTarget.name}" نهائياً.` : ''}
        confirmLabel={deleting ? 'جاري الحذف…' : 'حذف'}
        cancelLabel="إلغاء"
        loading={deleting}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title="حذف السجلات المحددة"
        description={`سيتم حذف ${selected.size} سجل نهائياً.`}
        confirmLabel={deleting ? 'جاري الحذف…' : 'حذف'}
        cancelLabel="رجوع"
        loading={deleting}
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
      {config.drawerFilters && (
        <AdvancedSearchDrawer open={showFilter} onClose={() => setShowFilter(false)} filters={config.drawerFilters} values={drawer} onApply={(v) => { setDrawer(v); setPage(1) }} />
      )}
    </div>
  )
}
