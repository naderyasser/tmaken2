'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Loader2, MoreVertical, Plus, Power,
  RotateCcw, Search, Trash2, Wifi, History, Pencil, Check, Copy,
} from 'lucide-react'
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

const ADMS = 'base_meena.biometric_management.adms'
const PAGE_SIZES = [10, 20, 50]

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
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionsOpen, setActionsOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return devices
    return devices.filter((d) =>
      deviceSerial(d).toLowerCase().includes(q) ||
      (d.device_name || '').toLowerCase().includes(q) ||
      (d.location || '').toLowerCase().includes(q))
  }, [devices, search])

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

  const pageNumbers = useMemo(() => {
    const out: number[] = []
    const from = Math.max(1, currentPage - 2)
    const to = Math.min(totalPages, from + 4)
    for (let i = from; i <= to; i++) out.push(i)
    return out
  }, [currentPage, totalPages])

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
  const bulkSetEnabled = async (enabled: boolean) => {
    setActionsOpen(false)
    setBulkBusy(true)
    let ok = 0
    for (const serial of selected) {
      try { await frappeClient.call(`${ADMS}.update_device`, { serial_number: serial, enabled: enabled ? 1 : 0 }); ok++ } catch { /* keep going */ }
    }
    setBulkBusy(false)
    toast({ title: enabled ? `تم تفعيل ${ok}` : `تم تعطيل ${ok}` })
    setSelected(new Set())
    load()
  }
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
    if (deviceForm.mode === 'add' && !deviceForm.serial.trim()) {
      toast({ title: 'الرقم التسلسلي مطلوب', variant: 'destructive' })
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

  const colSpan = 7

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

      <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 flex-wrap">
          <Button onClick={openAdd} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white rounded px-4 h-9 font-bold text-[13px] shrink-0">
            <Plus className="h-4 w-4 ml-1" strokeWidth={3} />
            اضافة
          </Button>

          <div className="relative shrink-0">
            <Button
              variant="outline"
              disabled={selected.size === 0 || bulkBusy}
              onClick={() => setActionsOpen((v) => !v)}
              className="rounded px-4 h-9 font-bold text-[13px] border-[var(--apex-slate)] text-[var(--apex-slate)] disabled:opacity-50 min-w-[120px] justify-between"
            >
              الاجراءات
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
            </Button>
            {actionsOpen && selected.size > 0 && (
              <div className="absolute z-20 mt-1 w-44 rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]">
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => bulkSetEnabled(true)}>تفعيل</button>
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => bulkSetEnabled(false)}>تعطيل</button>
                <button className="block w-full text-right px-3 py-1.5 hover:bg-slate-50 text-red-600" onClick={() => { setActionsOpen(false); setBulkDeleteOpen(true) }}>حذف</button>
              </div>
            )}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Input
              ref={searchRef}
              placeholder="ابحث بالرقم التسلسلي أو اسم الجهاز أو الموقع"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-9 rounded border-slate-300 text-right pr-9 placeholder:text-slate-400"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          </div>
        </div>

        {loadError && !loading && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>تعذّر تحميل الأجهزة من الخادم. تأكد من الاتصال ثم أعد المحاولة.</span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-right">
            <thead>
              <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
                <th className="px-3 w-10 text-center">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" aria-label="تحديد الكل" />
                </th>
                <th className="px-3 font-bold whitespace-nowrap">الرقم التسلسلي</th>
                <th className="px-3 font-bold whitespace-nowrap">اسم الجهاز</th>
                <th className="px-3 font-bold whitespace-nowrap">الموقع/الفرع</th>
                <th className="px-3 font-bold whitespace-nowrap">الحالة</th>
                <th className="px-3 font-bold whitespace-nowrap">عدد البصمات المزامنة</th>
                <th className="px-3 font-bold whitespace-nowrap">آخر IP</th>
                <th className="px-3 font-bold w-16 text-center whitespace-nowrap">الاجراءات</th>
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
              ) : pageRows.map((d) => {
                const serial = deviceSerial(d)
                const status = deviceStatus(d)
                return (
                  <tr key={serial} className="border-b border-slate-100 hover:bg-slate-50/70 h-[52px]">
                    <td className="px-3 text-center">
                      <input type="checkbox" checked={selected.has(serial)} onChange={() => toggleOne(serial)} className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" aria-label={`تحديد ${serial}`} />
                    </td>
                    <td className="px-3 font-mono text-slate-700">{serial}</td>
                    <td className="px-3 text-slate-700">{d.device_name || '—'}</td>
                    <td className="px-3 text-slate-700">{d.location || '—'}</td>
                    <td className="px-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[12px] font-bold whitespace-nowrap ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 text-slate-700">{d.total_synced_records ?? 0}</td>
                    <td className="px-3 font-mono text-slate-700" dir="ltr">{d.last_push_ip || '—'}</td>
                    <td className="px-3">
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button title="خيارات" className="text-slate-500 hover:text-slate-700 px-1" aria-label={`خيارات ${serial}`}>
                              <MoreVertical className="h-[18px] w-[18px]" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="text-[13px]">
                            <DropdownMenuItem onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5 ml-2" />تعديل</DropdownMenuItem>
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
                              <Trash2 className="h-3.5 w-3.5 ml-2" />حذف
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
        </div>

        {/* ── Pagination ── */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-3 py-3 text-[13px]">
          <div className="flex items-center gap-2 order-2 lg:order-1">
            <span className="font-bold text-slate-700">عدد الصفوف</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger aria-label="عدد الصفوف" className="w-[70px] h-9 rounded border-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent>{PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 order-1 lg:order-2">
            <button onClick={() => setPage(1)} disabled={currentPage === 1} aria-label="الصفحة الأولى" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40">«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="الصفحة السابقة" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronRight className="h-4 w-4 mx-auto" /></button>
            {pageNumbers.map((n) => (
              <button key={n} onClick={() => setPage(n)} aria-label={`الصفحة ${n}`} aria-current={n === currentPage ? 'page' : undefined} className={`h-8 min-w-8 px-2 rounded border text-[13px] font-bold ${n === currentPage ? 'bg-[var(--apex-blue-light)] border-[var(--apex-blue-light)] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{n}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="الصفحة التالية" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40"><ChevronLeft className="h-4 w-4 mx-auto" /></button>
            <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="الصفحة الأخيرة" className="h-8 w-8 rounded border border-slate-200 text-slate-500 disabled:opacity-40">»</button>
          </div>
          <div className="order-3 text-slate-500">{filtered.length} جهاز</div>
        </div>
      </div>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={!!deviceForm} onOpenChange={(o) => !o && closeDeviceForm()}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{deviceForm?.mode === 'edit' ? 'تعديل جهاز' : 'اضافة جهاز'}</DialogTitle>
          </DialogHeader>

          {registerSuccess ? (
            <div className="space-y-3">
              <div className="rounded bg-green-50 border border-green-200 p-3 text-[13px] text-[var(--apex-green-text)] leading-relaxed">
                <p className="font-bold mb-1">تم تسجيل الجهاز — اضبطه الآن على:</p>
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
              <DialogFooter>
                <Button onClick={closeDeviceForm} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white">
                  <Check className="h-4 w-4 ml-1" />تم
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-3 py-2">
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
                  <Label className="text-[13px] text-slate-600">اسم الجهاز</Label>
                  <Input value={deviceForm?.name ?? ''} onChange={(e) => setDeviceForm((f) => f && { ...f, name: e.target.value })} placeholder="اسم الجهاز" className="text-right" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-slate-600">الموقع/الفرع</Label>
                  {branches.length ? (
                    <Select value={deviceForm?.location || '__none__'} onValueChange={(v) => setDeviceForm((f) => f && { ...f, location: v === '__none__' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={deviceForm?.location ?? ''} onChange={(e) => setDeviceForm((f) => f && { ...f, location: e.target.value })} placeholder="الموقع/الفرع" className="text-right" />
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
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDeviceForm} disabled={saving}>إلغاء</Button>
                <Button onClick={() => submitDevice(false)} disabled={saving} className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white">
                  {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                  حفظ
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
