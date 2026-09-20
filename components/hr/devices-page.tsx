'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Loader2, MoreVertical, Plus, Power,
  RotateCcw, Trash2, Wifi, History, Pencil, Check, Copy,
} from 'lucide-react'
import { fmtDate } from '@/lib/hr-format'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { DeviceLogDrawer } from '@/components/hr/devices/log-drawer'
import { UnmappedPanel } from '@/components/hr/devices/unmapped-panel'
import { deviceSerial, deviceStatus, type BiometricDevice } from '@/components/hr/devices/types'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexPagination } from '@/components/hr/apex/pagination'
import { ApexDialog } from '@/components/hr/apex/dialog'

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

type DeviceForm = { mode: 'add' | 'edit'; serial: string; name: string; location: string }

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
  const [branchFilter, setBranchFilter] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [printRows, setPrintRows] = useState<BiometricDevice[] | null>(null)

  const [serverInfo, setServerInfo] = useState<{ server_ip?: string; server_port?: string } | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [addressCopied, setAddressCopied] = useState(false)

  const [deviceForm, setDeviceForm] = useState<DeviceForm | null>(null)
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

  const serverAddress = serverInfo?.server_ip && serverInfo?.server_port ? `${serverInfo.server_ip}:${serverInfo.server_port}` : null
  const copyServerAddress = async () => {
    if (!serverAddress) return
    try {
      await navigator.clipboard.writeText(serverAddress)
      setAddressCopied(true)
      setTimeout(() => setAddressCopied(false), 1500)
    } catch {
      toast({ title: 'تعذّر نسخ العنوان', variant: 'destructive' })
    }
  }

  // `location` on Biometric Device is free text ("Location / Branch" — not a
  // Link to Branch), so the filter's options come from whatever values
  // devices actually carry, not the Branch catalogue (that's `branches`
  // below, used only as suggestions on the add/edit form).
  const deviceLocations = useMemo(
    () => Array.from(new Set(devices.map((d) => d.location).filter((l): l is string => !!l))).sort(),
    [devices],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byBranch = branchFilter ? devices.filter((d) => (d.location || '') === branchFilter) : devices
    if (!q) return byBranch
    return byBranch.filter((d) =>
      deviceSerial(d).toLowerCase().includes(q) ||
      (d.device_name || '').toLowerCase().includes(q) ||
      (d.location || '').toLowerCase().includes(q))
  }, [devices, search, branchFilter])

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
    setPrintOpen(false)
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
      toast({ title: 'تم إرسال طلب إعادة المزامنة', description: 'تم جدولة إعادة المزامنة؛ سيبدأ الجهاز الإرسال عند الاستطلاع القادم' })
      setResyncDevice(null)
    } catch (err: any) {
      toast({ title: 'فشل طلب إعادة المزامنة', description: admsErrorAr(err), variant: 'destructive' })
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
  const openAdd = () => { setDeviceForm({ mode: 'add', serial: '', name: '', location: '' }); setFormError(null); setRegisterSuccess(null) }
  const openEdit = (d: BiometricDevice) => {
    setDeviceForm({ mode: 'edit', serial: deviceSerial(d), name: d.device_name || '', location: d.location || '' })
    setFormError(null)
    setRegisterSuccess(null)
  }
  const closeDeviceForm = () => { setDeviceForm(null); setFormError(null); setRegisterSuccess(null) }

  // Narrow on purpose — a stray "site" in an unrelated error must not surface the force-retry button.
  const looksLikeTenantConflict = !!formError && /(مستأجر|موقع آخر|another\s+(tenant|site))/i.test(formError)

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
        toast({ title: 'تم تسجيل الجهاز' })
        load()
      } else {
        await frappeClient.call(`${ADMS}.update_device`, {
          serial_number: deviceForm.serial, device_name: deviceForm.name.trim(), location: deviceForm.location.trim(),
        })
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

  const colSpan = 8

  return (
    <div dir="rtl" className="space-y-3 p-4 font-[family-name:var(--font-arabic)]">

      <div className="flex items-start gap-2 rounded bg-blue-50 border border-blue-200 px-3 py-2.5 text-[12.5px] text-blue-900 leading-relaxed">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          عنوان الخادم الحالي: <span dir="ltr" className="font-mono font-bold">{serverInfo?.server_ip || '—'}</span>
          {' '}· المنفذ <span dir="ltr" className="font-mono font-bold">{serverInfo?.server_port || '—'}</span> (HTTP).
          {' '}يجب تسجيل الجهاز من هذه الصفحة أولاً، ثم ضبط عنوان الخادم على الجهاز نفسه — وليس العكس.
          {serverAddress && (
            <button
              type="button"
              onClick={copyServerAddress}
              aria-label="نسخ عنوان الخادم"
              className="inline-flex align-middle mr-1 text-blue-700 hover:text-blue-900"
            >
              {addressCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </span>
      </div>

      <UnmappedPanel onMapped={load} />

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
                <th className="border border-slate-300 px-2 py-1 text-right">الموقع/الفرع</th>
                <th className="border border-slate-300 px-2 py-1 text-right">الحالة</th>
                <th className="border border-slate-300 px-2 py-1 text-right">عدد البصمات المزامنة</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map((d) => (
                <tr key={deviceSerial(d)}>
                  <td className="border border-slate-300 px-2 py-1">{deviceSerial(d)}</td>
                  <td className="border border-slate-300 px-2 py-1">{d.device_name || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1">{d.location || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1">{deviceStatus(d).label}</td>
                  <td className="border border-slate-300 px-2 py-1">{d.total_synced_records ?? 0}</td>
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
          search={{ value: search, onChange: (v) => { setSearch(v); setPage(1) }, placeholder: 'ابحث بالرقم التسلسلي أو اسم الجهاز أو الموقع' }}
          onFilter={() => setFilterOpen((v) => !v)}
          print={{ onPrint: () => doPrint(false), onAdvancedPrint: () => doPrint(true) }}
          deleteButton={{ onClick: () => setBulkDeleteOpen(true), disabled: selected.size === 0 }}
          add={{ label: 'اضافة', onClick: openAdd }}
        />

        {filterOpen && (
          <div dir="rtl" className="flex justify-start px-[5px] -mt-1 mb-2">
            <div className="w-52 rounded border border-slate-200 bg-white shadow-lg py-2 px-3 text-[13px]">
              <Label className="text-slate-600 text-[12px] mb-1 block">الفرع</Label>
              <Select value={branchFilter || '__all'} onValueChange={(v) => { setBranchFilter(v === '__all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="h-9 rounded border-slate-300 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">الكل</SelectItem>
                  {deviceLocations.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {loadError && !loading && (
          <div className="mb-2 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>تعذّر تحميل الأجهزة من الخادم. تأكد من الاتصال ثم أعد المحاولة.</span>
          </div>
        )}

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
                <th className="whitespace-nowrap">عدد البصمات المزامنة</th>
                <th className="whitespace-nowrap">آخر IP</th>
                <th className="apex-col-actions w-16 whitespace-nowrap">الاجراءات</th>
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
                const status = deviceStatus(d)
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
                    <td>
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[12px] font-bold whitespace-nowrap ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>{d.total_synced_records ?? 0}</td>
                    <td className="font-mono" dir="ltr">{d.last_push_ip || '—'}</td>
                    <td className="apex-col-actions">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button title="خيارات" className="apex-icon-more px-1" aria-label={`خيارات ${serial}`}>
                            <MoreVertical className="h-[18px] w-[18px]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="text-[13px]">
                          <DropdownMenuItem onClick={() => openEdit(d)}><Pencil className="apex-icon-edit h-3.5 w-3.5 ml-2" />تعديل</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEnabled(d)}>
                            <Power className="h-3.5 w-3.5 ml-2" />{d.enabled ? 'تعطيل' : 'تفعيل'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => testConnection(d)} disabled={testingSerial === serial}>
                            {testingSerial === serial ? <Loader2 className="h-3.5 w-3.5 ml-2 animate-spin" /> : <Wifi className="h-3.5 w-3.5 ml-2" />}
                            اختبار الاتصال
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResync(d)}><RotateCcw className="h-3.5 w-3.5 ml-2" />إعادة مزامنة</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLogDevice(d)}><History className="h-3.5 w-3.5 ml-2" />سجل الجهاز</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteTarget(d)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="apex-icon-delete h-3.5 w-3.5 ml-2" />حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        title={registerSuccess ? 'تم تسجيل الجهاز' : (deviceForm?.mode === 'edit' ? 'تعديل جهاز' : 'اضافة جهاز')}
        size="sm"
        primary={registerSuccess
          ? { label: 'تم', onClick: closeDeviceForm }
          : { label: 'حفظ', onClick: () => submitDevice(false), disabled: saving, loading: saving }}
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
            {deviceForm && deviceForm.mode === 'add' && (
              <div className="space-y-1.5">
                <Label className="text-[13px] text-slate-600">الرقم التسلسلي<span className="text-red-500"> *</span></Label>
                <Input
                  value={deviceForm.serial}
                  onChange={(e) => setDeviceForm((f) => f && { ...f, serial: e.target.value })}
                  placeholder="مثال: CJXK123456789"
                  className="text-right font-mono"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">الاسم بالعربية<span className="text-red-500"> *</span></Label>
              <Input value={deviceForm?.name ?? ''} onChange={(e) => setDeviceForm((f) => f && { ...f, name: e.target.value })} placeholder="الاسم بالعربية" className="text-right" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">الاسم بالانجليزية</Label>
              {/* Biometric Device has no English-name field on the backend
                  (checked 2026-09-20) — shown to match Apex's field set but
                  kept disabled rather than silently faking persistence. */}
              <Input value="" disabled placeholder="غير مدعوم من الخادم حالياً" className="text-right bg-slate-50 text-slate-400 cursor-not-allowed" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-slate-600">الفرع<span className="text-red-500"> *</span></Label>
              {branches.length ? (
                <Select value={deviceForm?.location || '__none__'} onValueChange={(v) => setDeviceForm((f) => f && { ...f, location: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={deviceForm?.location ?? ''} onChange={(e) => setDeviceForm((f) => f && { ...f, location: e.target.value })} placeholder="الفرع" className="text-right" />
              )}
            </div>

            {formError && (
              <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-[12.5px] text-[var(--apex-red-text)] leading-relaxed">
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

      {/* ── Resync dialog ── */}
      <Dialog open={!!resyncDevice} onOpenChange={(o) => !o && setResyncDevice(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>إعادة مزامنة — {resyncDevice ? deviceSerial(resyncDevice) : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-[13px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={resyncAll} onChange={(e) => setResyncAll(e.target.checked)} className="h-4 w-4 accent-[var(--apex-blue)]" />
              إعادة إرسال كل السجلات منذ بداية عمل الجهاز
            </label>
            {!resyncAll && (
              <div className="space-y-1.5">
                <Label className="text-[13px] text-slate-600">إعادة الإرسال من تاريخ</Label>
                <LocalizedDateInput value={resyncDate} onChange={setResyncDate} locale="ar" />
              </div>
            )}
            <p className="text-[12px] text-slate-500">يجب أن يكون الجهاز متصلاً بالإنترنت ليستلم الأمر عند أول اتصال قادم.</p>
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
