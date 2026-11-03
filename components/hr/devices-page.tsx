'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Loader2, MoreVertical, Plus, Power,
  RotateCcw, Trash2, Wifi, Fingerprint, Pencil,
} from 'lucide-react'
import { fmtDate } from '@/lib/hr-format'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { DeviceLogDrawer } from '@/components/hr/devices/log-drawer'
import { deviceSerial, type BiometricDevice } from '@/components/hr/devices/types'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'
import { AdvancedSearchDrawer, applyDrawer, type DrawerFilter, type DrawerValues } from '@/components/hr/advanced-search-drawer'
import { ViewRecordDialog } from '@/components/hr/apex/view-record-dialog'
import { VersionLogDialog } from '@/components/hr/apex/version-log-dialog'

const ADMS = 'base_meena.biometric_management.adms'
// 5.22: Apex's devices page size is 5 (this list's own default, not the
// shared [5,10,20,50] ApexPagination offers as choices).
const PAGE_SIZES = [5, 10, 20, 50]

// base_meena.biometric_management.adms (test_device_connection / request_device_resync /
// update_device / reset_device_errors) returns plain-English message/status strings —
// no Arabic translation is loaded for this site — so every toast below must map them to
// Arabic itself and never show the raw English text alongside the Arabic title.
const ADMS_MESSAGE_AR: Record<string, string> = {
  'Device not registered': 'الجهاز غير مسجّل في هذا الموقع',
  'Device never connected': 'الجهاز لم يتصل بعد',
}
const ADMS_GENERIC_ERROR_AR = 'تعذّر تنفيذ العملية على الجهاز'

function admsErrorAr(err: any): string {
  const raw = err?.message
  if (typeof raw === 'string') {
    if (ADMS_MESSAGE_AR[raw]) return ADMS_MESSAGE_AR[raw]
    const notFound = raw.match(/^Device (.+?) not found$/)
    if (notFound) return `الجهاز ${notFound[1]} غير موجود`
  }
  return ADMS_GENERIC_ERROR_AR
}

// Builds the test_device_connection toast entirely in Arabic: "connected" and
// "seconds_ago" are structured fields (never English text), and any "message"
// string (only sent for the not-registered / never-connected cases) is mapped
// above — an unmapped one falls back to a generic Arabic line, never itself.
function connectionStatusAr(data?: { connected?: boolean; seconds_ago?: number; message?: string }) {
  if (data?.connected) {
    return { title: 'الجهاز متصل', description: `آخر اتصال منذ ${data.seconds_ago ?? 0} ثانية` }
  }
  if (typeof data?.seconds_ago === 'number') {
    const minutes = Math.max(0, Math.round(data.seconds_ago / 60))
    return { title: 'الجهاز غير متصل', description: `آخر ظهور منذ ${minutes} دقيقة` }
  }
  const known = data?.message ? ADMS_MESSAGE_AR[data.message] : undefined
  return { title: 'الجهاز غير متصل', description: known || 'لم يصل أي اتصال من الجهاز بعد' }
}

// device_clock.get_clock_status — offset in effect + last observed skew + held punches.
type ClockStatus = {
  name: string; clock_offset_minutes?: number; clock_offset_source?: string; clock_offset_since?: string
  clock_skew_minutes?: number; held_punches: number; flagged: boolean
}
const CLOCK = 'base_meena.biometric_management.device_clock'

type DeviceForm = { mode: 'add' | 'edit'; serial: string; name: string; nameEn: string; location: string }

/**
 * «الاجهزة» — bespoke fingerprint-device management page (not GenericListPage: the row
 * actions and the log/mapping drawers need real behaviour, not the generic CRUD dialog).
 * Toolbar/table classes mirror components/hr/generic-list-page.tsx for a consistent shell.
 */
export function DevicesPage() {
  const { toast } = useToast()
  const [devices, setDevices] = useState<BiometricDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [drawerValues, setDrawerValues] = useState<DrawerValues>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewDevice, setViewDevice] = useState<BiometricDevice | null>(null)
  const [historyDevice, setHistoryDevice] = useState<BiometricDevice | null>(null)
  const [printRows, setPrintRows] = useState<BiometricDevice[] | null>(null)

  const [serverInfo, setServerInfo] = useState<{ server_ip?: string; server_port?: string } | null>(null)
  const [branches, setBranches] = useState<string[]>([])

  const [deviceForm, setDeviceForm] = useState<DeviceForm | null>(null)
  const [clock, setClock] = useState<Record<string, ClockStatus>>({})
  const [offsetDevice, setOffsetDevice] = useState<{ serial: string; minutes: string; note: string } | null>(null)
  const [savingOffset, setSavingOffset] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState<{ server_ip: string; server_port: string } | null>(null)

  const [testingSerial, setTestingSerial] = useState<string | null>(null)
  const [resyncDevice, setResyncDevice] = useState<BiometricDevice | null>(null)
  const [resyncDate, setResyncDate] = useState('')
  const [resyncAll, setResyncAll] = useState(true)
  const [resyncing, setResyncing] = useState(false)

  const [logDevice, setLogDevice] = useState<BiometricDevice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BiometricDevice | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const resp = await frappeClient.call<BiometricDevice[]>(`${ADMS}.get_device_list`)
      setDevices(Array.isArray(resp.message) ? resp.message : [])
      frappeClient.call<ClockStatus[]>(`${CLOCK}.get_clock_status`)
        .then((r) => setClock(Object.fromEntries((r.message ?? []).map((c) => [c.name, c]))))
        .catch(() => setClock({}))
    } catch (err) {
      console.error('Failed to load devices:', err)
      setLoadError(true)
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    frappeClient.call<{ server_ip?: string; server_port?: string }>(`${ADMS}.get_server_info`)
      .then((r) => setServerInfo(r.message ?? null))
      .catch(() => {})
    frappeClient.getList<{ name: string }>('Branch', { fields: ['name'], order_by: 'name asc', limit_page_length: 0 })
      .then((rows) => setBranches(rows.map((b) => b.name)))
      .catch(() => setBranches([]))
  }, [load])

  // `location` on Biometric Device is free text ("Location / Branch" — not a
  // Link to Branch), so the filter's options come from whatever values
  // devices actually carry, not the Branch catalogue (that's `branches`
  // below, used only as suggestions on the add/edit form).
  const deviceLocations = useMemo(
    () => Array.from(new Set(devices.map((d) => d.location).filter((l): l is string => !!l))).sort(),
    [devices],
  )

  // Apex «بحث متقدم»: one «الفروع» accordion — search box, «الكل», a checkbox per branch
  const drawerFilters: DrawerFilter[] = useMemo(() => [{
    field: 'location', label: 'الفروع', multi: true, searchPlaceholder: 'البحث باسم الفرع',
    options: Array.from(new Set([...branches, ...deviceLocations])).sort(),
  }], [branches, deviceLocations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byBranch = applyDrawer(devices, drawerFilters, drawerValues)
    if (!q) return byBranch
    return byBranch.filter((d) =>
      deviceSerial(d).toLowerCase().includes(q) ||
      (d.device_name || '').toLowerCase().includes(q) ||
      (d.location || '').toLowerCase().includes(q))
  }, [devices, search, drawerFilters, drawerValues])

  // Printing mirrors components/hr/generic-list-page.tsx: render a hidden
  // print-only table into `printRows`, call window.print(), then restore the
  // normal screen view once the print dialog closes (or is cancelled).
  useEffect(() => {
    const restore = () => setPrintRows(null)
    window.addEventListener('afterprint', restore)
    return () => window.removeEventListener('afterprint', restore)
  }, [])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const allChecked = pageRows.length > 0 && pageRows.every((d) => selected.has(deviceSerial(d)))

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev)
    if (allChecked) pageRows.forEach((d) => next.delete(deviceSerial(d)))
    else pageRows.forEach((d) => next.add(deviceSerial(d)))
    return next
  })
  const toggleOne = (serial: string) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(serial) ? next.delete(serial) : next.add(serial)
    return next
  })


  /** «طباعة الصفحة» prints just the current page's rows; «طباعة الكل» prints
   *  every row matching the active search/branch filter. */
  const doPrint = (all: boolean) => {
    setPrintRows(all ? filtered : pageRows)
    requestAnimationFrame(() => window.print())
  }

  // ── row actions ──────────────────────────────────────────────────────
  const toggleEnabled = async (d: BiometricDevice) => {
    try {
      await frappeClient.call(`${ADMS}.update_device`, { serial_number: deviceSerial(d), enabled: d.enabled ? 0 : 1 })
      toast({ title: d.enabled ? 'تم تعطيل الجهاز' : 'تم تفعيل الجهاز' })
      load()
    } catch (err: any) {
      toast({ title: 'فشل تحديث حالة الجهاز', description: admsErrorAr(err), variant: 'destructive' })
    }
  }

  const testConnection = async (d: BiometricDevice) => {
    const serial = deviceSerial(d)
    setTestingSerial(serial)
    try {
      const resp = await frappeClient.call<{ connected: boolean; seconds_ago?: number; message?: string }>(
        `${ADMS}.test_device_connection`, { serial_number: serial },
      )
      const data = resp.message
      const { title, description } = connectionStatusAr(data)
      toast({ title, description, variant: data?.connected ? undefined : 'destructive' })
    } catch (err: any) {
      toast({ title: 'تعذّر اختبار الاتصال', description: admsErrorAr(err), variant: 'destructive' })
    } finally {
      setTestingSerial(null)
    }
  }

  const openResync = (d: BiometricDevice) => { setResyncDevice(d); setResyncDate(''); setResyncAll(true) }
  const submitResync = async () => {
    if (!resyncDevice) return
    setResyncing(true)
    try {
      const stamp = resyncAll || !resyncDate ? '0' : resyncDate
      await frappeClient.call(`${ADMS}.request_device_resync`, {
        serial_number: deviceSerial(resyncDevice), from_stamp: stamp,
      })
      toast({ title: 'تم إرسال طلب سحب البصمات', description: 'سيبدأ الجهاز إرسال البصمات السابقة عند اتصاله القادم' })
      setResyncDevice(null)
    } catch (err: any) {
      toast({ title: 'فشل طلب سحب البصمات', description: admsErrorAr(err), variant: 'destructive' })
    } finally {
      setResyncing(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await frappeClient.call(`${ADMS}.unregister_device`, { serial_number: deviceSerial(deleteTarget) })
      toast({ title: 'تم حذف الجهاز' })
      setDeleteTarget(null)
      load()
    } catch (err: any) {
      setDeleteTarget(null)  // same as generic-list-page: don't leave «سيتم حذف…» open over the error
      toast({ title: 'فشل الحذف', description: err?.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── bulk toolbar actions ─────────────────────────────────────────────
  // 5.22: the toolbar's «حذف» replaces «الاجراءات» (Apex has no bulk
  // enable/disable in this toolbar) — per-row enable/disable stays in the
  // row ⋮ menu below (kept as X, Apex's own row menu doesn't offer it either
  // but it's useful and doesn't contradict the toolbar spec).
  const confirmBulkDelete = async () => {
    setDeleting(true)
    let ok = 0, failed = 0
    for (const serial of selected) {
      try { await frappeClient.call(`${ADMS}.unregister_device`, { serial_number: serial }); ok++ } catch { failed++ }
    }
    setDeleting(false)
    setBulkDeleteOpen(false)
    setSelected(new Set())
    toast({ title: `تم حذف ${ok}`, description: failed ? `تعذّر حذف ${failed}` : undefined, variant: failed ? 'destructive' : undefined })
    load()
  }

  // ── add / edit dialog ────────────────────────────────────────────────
  const openAdd = () => { setDeviceForm({ mode: 'add', serial: '', name: '', nameEn: '', location: '' }); setFormError(null); setRegisterSuccess(null) }
  const openEdit = (d: BiometricDevice) => {
    const serial = deviceSerial(d)
    setDeviceForm({ mode: 'edit', serial, name: d.device_name || '', nameEn: '', location: d.location || '' })
    // get_device_list doesn't return the (tenant custom) English name — fetch it separately.
    frappeClient.call<{ device_name_en?: string }>('frappe.client.get_value', { doctype: 'Biometric Device', filters: serial, fieldname: 'device_name_en' })
      .then((r) => setDeviceForm((f) => f && f.serial === serial ? { ...f, nameEn: r.message?.device_name_en || '' } : f))
      .catch(() => {})
    setFormError(null)
    setRegisterSuccess(null)
  }
  const closeDeviceForm = () => { setDeviceForm(null); setFormError(null); setRegisterSuccess(null) }

  // Narrow on purpose — a stray "site" in an unrelated error must not surface the force-retry button.
  const looksLikeTenantConflict = !!formError && /(مستأجر|موقع آخر|another\s+(tenant|site))/i.test(formError)

  // «الاسم بالانجليزية» lives in a Custom Field (device_name_en), which the ADMS
  // register/update endpoints don't know about — written with a separate set_value.
  const saveEnglishName = async (serial: string) => {
    if (!deviceForm || (deviceForm.mode === 'add' && !deviceForm.nameEn.trim())) return
    await frappeClient.call('frappe.client.set_value', {
      doctype: 'Biometric Device', name: serial, fieldname: 'device_name_en', value: deviceForm.nameEn.trim(),
    })
  }

  const submitDevice = async (force = false) => {
    if (!deviceForm) return
    // 5.22: الاسم بالعربية* and الفرع* are required (in addition to الرقم
    // التسلسلي*, add-only, already checked below).
    if (deviceForm.mode === 'add' && !deviceForm.serial.trim()) {
      toast({ title: 'الرقم التسلسلي مطلوب', variant: 'destructive' })
      return
    }
    if (!deviceForm.name.trim()) {
      toast({ title: 'الاسم بالعربية مطلوب', variant: 'destructive' })
      return
    }
    if (!deviceForm.location.trim()) {
      toast({ title: 'الفرع مطلوب', variant: 'destructive' })
      return
    }
    if (branches.length && !branches.includes(deviceForm.location.trim())) {
      toast({ title: 'اختر الفرع من القائمة', variant: 'destructive' })
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (deviceForm.mode === 'add') {
        const serial = deviceForm.serial.trim().toUpperCase()
        const args: Record<string, any> = {
          serial_number: serial,
          device_name: deviceForm.name.trim() || undefined,
          location: deviceForm.location.trim() || undefined,
        }
        if (force) args.force = 1
        const resp = await frappeClient.call<{ server_ip?: string; server_port?: string }>(`${ADMS}.register_device`, args)
        const info = resp.message
        setRegisterSuccess({
          server_ip: info?.server_ip || serverInfo?.server_ip || '',
          server_port: info?.server_port || serverInfo?.server_port || '',
        })
        await saveEnglishName(serial)
        toast({ title: 'تم تسجيل الجهاز' })
        load()
      } else {
        await frappeClient.call(`${ADMS}.update_device`, {
          serial_number: deviceForm.serial, device_name: deviceForm.name.trim(), location: deviceForm.location.trim(),
        })
        await saveEnglishName(deviceForm.serial)
        toast({ title: 'تم الحفظ' })
        closeDeviceForm()
        load()
      }
    } catch (err: any) {
      setFormError(err?.message || 'تعذّر الاتصال بالخادم')
    } finally {
      setSaving(false)
    }
  }

  const colSpan = 6

  return (
    <div dir="rtl" className="space-y-3 p-4 font-[family-name:var(--font-arabic)]">


      {/* ── Print-only view (see app/globals.css for the rules that hide the
          sidebar/topbar around it) ── */}
      {printRows && (
        <div className="hidden print:block">
          <h1 className="text-lg font-bold mb-1">الاجهزة</h1>
          <p className="text-xs text-slate-500 mb-4">{fmtDate(new Date())}</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-right">الرقم التسلسلي</th>
                <th className="border border-slate-300 px-2 py-1 text-right">اسم الجهاز</th>
                <th className="border border-slate-300 px-2 py-1 text-right">فرع</th>
                <th className="border border-slate-300 px-2 py-1 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map((d) => (
                <tr key={deviceSerial(d)}>
                  <td className="border border-slate-300 px-2 py-1">{deviceSerial(d)}</td>
                  <td className="border border-slate-300 px-2 py-1">{d.device_name || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1">{d.location || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1">{lastSeenLabel(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Toolbar (5.22 + shared contract): bare row above the table card,
          «حذف» replaces «الاجراءات», RTL order search→filter→طباعة→حذف→اضافة ── */}
      <div className="print:hidden">
        <ApexToolbar
          search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: 'ابحث بالاسم' }}
          onFilter={() => setFilterOpen(true)}
          print={{ onPrint: () => doPrint(false), onAdvancedPrint: () => doPrint(true) }}
          deleteButton={{ onClick: () => setBulkDeleteOpen(true), disabled: selected.size === 0 }}
          add={{ label: 'اضافة', onClick: openAdd }}
        />

        <AdvancedSearchDrawer
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filters={drawerFilters}
          values={drawerValues}
          onApply={(v) => { setDrawerValues(v); setPage(1) }}
        />

        {loadError && !loading && (
          <div className="mb-2 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>تعذّر تحميل الأجهزة من الخادم. تأكد من الاتصال ثم أعد المحاولة.</span>
          </div>
        )}

        {Object.values(clock).filter((c) => c.flagged).map((c) => {
          const dev = devices.find((d) => deviceSerial(d) === c.name)
          const skew = c.clock_skew_minutes ?? 0
          return (
            <div key={c.name} data-testid="clock-warning" className="mb-2 flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                ساعة الجهاز <b>{dev?.device_name || c.name}</b> {skew >= 0 ? 'متقدمة' : 'متأخرة'} بحوالي <b>{Math.abs(skew)}</b> دقيقة.
                {' '}{c.clock_offset_minutes
                  ? <>يتم تصحيح الحركات تلقائياً بـ {c.clock_offset_minutes} دقيقة ({c.clock_offset_source === 'manual' ? 'يدوي' : 'تلقائي'}).</>
                  : <>لا يوجد تصحيح بعد.</>}
                {c.held_punches > 0 && <> {c.held_punches} حركة محفوظة بانتظار التصحيح.</>}
                {' '}اضبط وقت الجهاز أو المنطقة الزمنية (GMT+3).
              </span>
              <button type="button" onClick={() => setOffsetDevice({ serial: c.name, minutes: String(c.clock_offset_minutes ?? 0), note: '' })}
                className="ms-auto rounded border border-amber-300 bg-white px-2 py-0.5 text-[12px] hover:bg-amber-100">ضبط فرق الساعة</button>
            </div>
          )
        })}

        {/* ── Table (5.22 columns: ☐ · م · الرقم التسلسلي · اسم الجهاز · فرع ·
            الحالة · الاجراءات — synced-count/last-IP kept as X extras) ── */}
        <ApexTableCard>
          <table className="apex-table">
            <thead>
              <tr>
                <th className="w-10 text-center">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" aria-label="تحديد الكل" />
                </th>
                <th className="w-12 text-center">م</th>
                <th className="whitespace-nowrap">الرقم التسلسلي</th>
                <th className="whitespace-nowrap">اسم الجهاز</th>
                <th className="whitespace-nowrap">فرع</th>
                <th className="whitespace-nowrap">الحالة</th>
                <th className="apex-col-actions w-28 whitespace-nowrap">الاجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan + 1} className="py-14 text-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--apex-blue-light)] mx-auto" /></td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={colSpan + 1} className="py-14 text-center">
                  <p className="text-[16px] font-bold text-slate-700 mb-3">لا توجد أجهزة مسجّلة بعد</p>
                  <button type="button" onClick={openAdd} className="h-[40px] px-5 rounded bg-[var(--apex-green)] text-white text-[14px] inline-flex items-center gap-2 hover:bg-[var(--apex-green-dark)]">
                    <Plus className="h-4 w-4" strokeWidth={3} />اضافة جهاز
                  </button>
                </td></tr>
              ) : pageRows.map((d, i) => {
                const serial = deviceSerial(d)
                const rowNumber = (currentPage - 1) * pageSize + i + 1
                return (
                  <tr key={serial}>
                    <td className="text-center">
                      <input type="checkbox" checked={selected.has(serial)} onChange={() => toggleOne(serial)} className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" aria-label={`تحديد ${serial}`} />
                    </td>
                    <td className="text-center text-slate-500">{rowNumber}</td>
                    <td className="font-mono">{serial}</td>
                    <td>{d.device_name || '—'}</td>
                    <td>{d.location || '—'}</td>
                    <td className="whitespace-nowrap">
                      <span className={lastSeenClass(d)}>{lastSeenLabel(d)}</span>
                      {clock[serial]?.flagged && <span className="ms-1 text-amber-600" title="ساعة الجهاز غير مضبوطة">⚠</span>}
                    </td>
                    <td className="apex-col-actions">
                      <div className="inline-flex items-center">
                      <button onClick={() => openEdit(d)} title="تعديل" aria-label={`تعديل ${serial}`} className="apex-icon-edit px-1 hover:opacity-75"><Pencil className="h-[17px] w-[17px]" /></button>
                      <span className="mx-1 h-4 w-px bg-slate-200" />
                      <button onClick={() => setDeleteTarget(d)} title="حذف" aria-label={`حذف ${serial}`} className="apex-icon-delete px-1 hover:opacity-75"><Trash2 className="h-[17px] w-[17px]" /></button>
                      <span className="mx-1 h-4 w-px bg-slate-200" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button title="خيارات" className="apex-icon-more px-1" aria-label={`خيارات ${serial}`}>
                            <MoreVertical className="h-[18px] w-[18px]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="text-[13px]">
                          <DropdownMenuItem onClick={() => setViewDevice(d)}>عرض</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setHistoryDevice(d)}>سجل الحركات</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleEnabled(d)}>
                            <Power className="h-3.5 w-3.5 ml-2" />{d.enabled ? 'تعطيل' : 'تفعيل'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => testConnection(d)} disabled={testingSerial === serial}>
                            {testingSerial === serial ? <Loader2 className="h-3.5 w-3.5 ml-2 animate-spin" /> : <Wifi className="h-3.5 w-3.5 ml-2" />}
                            اختبار الاتصال
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResync(d)}><RotateCcw className="h-3.5 w-3.5 ml-2" />سحب كل البصمات السابقة</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLogDevice(d)}><Fingerprint className="h-3.5 w-3.5 ml-2" />سجل البصمات</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setOffsetDevice({ serial, minutes: String(clock[serial]?.clock_offset_minutes ?? 0), note: '' })}>
                            <RotateCcw className="h-3.5 w-3.5 ml-2" />ضبط فرق الساعة
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ApexTableCard>

        {/* ── Pagination (5.22: page size 5 default) ── */}
        <ApexPagination
          page={currentPage}
          pageCount={totalPages}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZES}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        />
      </div>

      {/* ── Add / Edit dialog (5.22 / G7 + shared contract's ApexDialog: 480px,
          single column, ✕ top-left, ONE green button bottom-left, no cancel) ── */}
      <ApexDialog
        open={!!deviceForm}
        onOpenChange={(o) => !o && closeDeviceForm()}
        title={registerSuccess ? 'تم تسجيل الجهاز' : (deviceForm?.mode === 'edit' ? 'تعديل الاجهزة' : 'اضافة الاجهزة')}
        size={registerSuccess ? 'sm' : 'lg'}
        primary={registerSuccess
          ? { label: 'تم', onClick: closeDeviceForm }
          : { label: deviceForm?.mode === 'edit' ? 'حفظ' : 'اضافة', onClick: () => submitDevice(false), disabled: saving, loading: saving }}
      >
        {registerSuccess ? (
          <div className="space-y-3">
            <div className="rounded bg-green-50 border border-green-200 p-3 text-[13px] text-[var(--apex-green-text)] leading-relaxed">
              <p className="font-bold mb-1">اضبط الجهاز الآن على:</p>
              <p>
                Server <span dir="ltr" className="font-mono font-bold">{registerSuccess.server_ip}</span>
                {' '}· Port <span dir="ltr" className="font-mono font-bold">{registerSuccess.server_port}</span>
                {' '}· HTTP (بدون HTTPS)
              </p>
            </div>
            <ol className="list-decimal pr-5 space-y-1 text-[13px] text-slate-700">
              <li>من قائمة الجهاز، ادخل على Comm (الاتصال)</li>
              <li>اختر Cloud Server Setting (إعداد خادم السحابة)</li>
              <li>أدخل عنوان الخادم والمنفذ أعلاه، ثم أعد تشغيل الجهاز</li>
            </ol>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">الاسم بالعربية<span className="text-red-500"> *</span></Label>
              <Input value={deviceForm?.name ?? ''} onChange={(e) => setDeviceForm((f) => f && { ...f, name: e.target.value })} placeholder="الاسم بالعربية" className="text-right" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">الاسم بالانجليزية</Label>
              <Input value={deviceForm?.nameEn ?? ''} onChange={(e) => setDeviceForm((f) => f && { ...f, nameEn: e.target.value })} placeholder="الاسم بالانجليزية" dir="ltr" className="text-left" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">الفرع<span className="text-red-500"> *</span></Label>
              {/* A real dropdown: a <datalist> prefilled with the current branch
                  only ever suggested that same branch, so editing could never
                  pick another one. */}
              <select
                aria-label="الفرع"
                value={deviceForm?.location ?? ''}
                onChange={(e) => setDeviceForm((f) => f && { ...f, location: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-right shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">الفرع</option>
                {deviceForm?.location && !branches.includes(deviceForm.location) && (
                  <option value={deviceForm.location}>{deviceForm.location}</option>
                )}
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {deviceForm && (
              <div className="space-y-1.5">
                <Label className="text-[13px] text-slate-600">الرقم التسلسلي<span className="text-red-500"> *</span></Label>
                <Input
                  value={deviceForm.serial}
                  disabled={deviceForm.mode === 'edit'}
                  onChange={(e) => setDeviceForm((f) => f && { ...f, serial: e.target.value })}
                  placeholder="مثال: CJXK123456789"
                  className="text-right font-mono"
                />
              </div>
            )}
            {formError && (
              <div className="col-span-full rounded bg-red-50 border border-red-200 px-3 py-2 text-[12.5px] text-[var(--apex-red-text)] leading-relaxed">
                {formError}
                {looksLikeTenantConflict && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => submitDevice(true)} className="border-[var(--apex-red)] text-[var(--apex-red)] hover:bg-red-50 h-8 text-[12.5px]">
                      إعادة المحاولة ونقل الجهاز لهذا الموقع
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </ApexDialog>

      {/* ── Manual clock offset (audited server-side as a Comment on the device) ── */}
      <ApexDialog
        open={!!offsetDevice}
        onOpenChange={(o) => !o && setOffsetDevice(null)}
        title="ضبط فرق ساعة الجهاز"
        size="sm"
        primary={{
          label: 'حفظ', disabled: savingOffset, loading: savingOffset,
          onClick: async () => {
            if (!offsetDevice) return
            setSavingOffset(true)
            try {
              await frappeClient.call(`${CLOCK}.set_manual_offset`, {
                serial_number: offsetDevice.serial, minutes: parseInt(offsetDevice.minutes || '0', 10) || 0, note: offsetDevice.note,
              })
              toast({ title: 'تم حفظ فرق الساعة وإعادة معالجة الحركات المحفوظة' })
              setOffsetDevice(null)
              load()
            } catch (err: any) {
              toast({ title: err?.message || 'تعذّر الحفظ', variant: 'destructive' })
            } finally {
              setSavingOffset(false)
            }
          },
        }}
      >
        <div className="space-y-1.5">
          <Label className="text-[13px] text-slate-600">الفرق بالدقائق (وقت الجهاز − الوقت الحقيقي)</Label>
          <Input type="number" dir="ltr" value={offsetDevice?.minutes ?? ''} onChange={(e) => setOffsetDevice((o) => o && { ...o, minutes: e.target.value })} />
          <p className="text-[11.5px] text-slate-500">مثال: الجهاز متقدم 5 ساعات = 300. يُلغى تلقائياً عند ضبط ساعة الجهاز.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] text-slate-600">ملاحظة</Label>
          <Input value={offsetDevice?.note ?? ''} onChange={(e) => setOffsetDevice((o) => o && { ...o, note: e.target.value })} className="text-right" />
        </div>
      </ApexDialog>

      {/* ── Resync dialog ── */}
      <Dialog open={!!resyncDevice} onOpenChange={(o) => !o && setResyncDevice(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>سحب البصمات السابقة — {resyncDevice ? deviceSerial(resyncDevice) : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-[13px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={resyncAll} onChange={(e) => setResyncAll(e.target.checked)} className="h-4 w-4 accent-[var(--apex-blue)]" />
              كل البصمات المخزنة في الجهاز منذ بداية عمله
            </label>
            {!resyncAll && (
              <div className="space-y-1.5">
                <Label className="text-[13px] text-slate-600">البصمات من تاريخ</Label>
                <LocalizedDateInput value={resyncDate} onChange={setResyncDate} locale="ar" />
              </div>
            )}
            <p className="text-[12px] text-slate-500">يجب أن يكون الجهاز متصلاً بالإنترنت ليستلم الأمر عند أول اتصال قادم. قد يستغرق الجهاز الكبير عدة دقائق؛ البصمات المكررة تُتجاهل تلقائياً، وبصمات الأرقام غير المربوطة بموظف تظهر في «موظفين غير مسجلين» وتُحتسب فور ربطها.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResyncDevice(null)} disabled={resyncing}>إلغاء</Button>
            <Button onClick={submitResync} disabled={resyncing} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white">
              {resyncing && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewRecordDialog
        open={!!viewDevice}
        onOpenChange={(o) => !o && setViewDevice(null)}
        title="عرض الاجهزة"
        fields={viewDevice ? [
          { label: 'الرقم التسلسلي', value: <span className="font-mono">{deviceSerial(viewDevice)}</span> },
          { label: 'اسم الجهاز', value: viewDevice.device_name || '—' },
          { label: 'فرع', value: viewDevice.location || '—' },
          { label: 'الحالة', value: <span className={lastSeenClass(viewDevice)}>{lastSeenLabel(viewDevice)}</span> },
          { label: 'عدد البصمات المزامنة', value: viewDevice.total_synced_records ?? 0 },
        ] : []}
      />
      <VersionLogDialog
        open={!!historyDevice}
        onOpenChange={(o) => !o && setHistoryDevice(null)}
        doctype="Biometric Device"
        name={historyDevice ? deviceSerial(historyDevice) : ''}
        labels={{ device_name: 'اسم الجهاز', device_name_en: 'الاسم بالانجليزية', location: 'فرع', enabled: 'مفعل' }}
      />

      <DeviceLogDrawer open={!!logDevice} onClose={() => setLogDevice(null)} serial={logDevice ? deviceSerial(logDevice) : ''} deviceName={logDevice?.device_name} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="تأكيد حذف الجهاز"
        description={deleteTarget ? `سيتم حذف الجهاز "${deviceSerial(deleteTarget)}" وسجلاته نهائياً.` : ''}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        loading={deleting}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="حذف الأجهزة المحددة"
        description={`سيتم حذف ${selected.size} جهاز نهائياً.`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={deleting}
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
    </div>
  )
}

/** Apex «الحالة» cell: «اخر ظهور: YYYY-MM-DD HH:MM», green while the device is
 *  polling, red once it has gone quiet; «لم يتصل بعد» / «معطّل» otherwise. */
function lastSeenLabel(d: BiometricDevice): string {
  if (!d.enabled) return 'معطّل'
  if (!d.last_activity) return 'لم يتصل بعد'
  // Apex: «اخر ظهور: DD-MM-YYYY HH:mm»
  const [day, time] = String(d.last_activity).split(' ')
  const [y, m, dd] = day.split('-')
  return `اخر ظهور: ${dd}-${m}-${y} ${(time || '').slice(0, 5)}`
}

function lastSeenClass(d: BiometricDevice): string {
  if (!d.enabled) return 'text-slate-400'
  if (!d.last_activity) return 'text-amber-600'
  return d.is_online ? 'text-[var(--apex-green)]' : 'text-[var(--apex-red)]'
}
