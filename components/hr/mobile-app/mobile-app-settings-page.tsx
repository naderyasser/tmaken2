'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  AlertCircle, Copy, KeyRound, Loader2, LocateFixed, MapPin, MoreVertical, Pencil, Plus, Search,
  Smartphone, UserX, RotateCcw,
} from 'lucide-react'

import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { PickerLocation } from '@/components/hr/mobile-app/location-picker-map'

const LocationPickerMap = dynamic(() => import('@/components/hr/mobile-app/location-picker-map'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
})

const APP = 'base_meena.mobile_attendance.tamken_app'
const LOC = 'base_meena.api.hr_locations'
const TRACK_INTERVALS = [1, 2, 5, 10, 15, 30]

const TrackingTab = dynamic(() => import('@/components/hr/mobile-app/tracking-tab'), {
  ssr: false,
  loading: () => <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>,
})

async function call<T = any>(method: string, args?: Record<string, any>): Promise<T> {
  const r = await frappeClient.call<T>(method, args)
  return (r as any)?.message as T
}

interface EmpRow {
  employee: string
  employee_name: string
  number: string
  branch: string | null
  designation: string | null
  app_enabled: boolean
  punch_enabled: boolean
  locations: string[]
  usable_locations: number
  has_account: boolean
  is_app_user: boolean
  passkeys: number
  last_app_punch: string | null
  tracking_enabled: boolean
  tracking_consent: boolean
  tracking_interval: number
}

interface Overview {
  employees: EmpRow[]
  locations: { name: string; label: string; usable: boolean }[]
  require_passkey: boolean
}

interface LocRow extends PickerLocation {
  custom_name_en?: string | null
}

/**
 * «تطبيق الجوال» — HR settings for the employees' mobile check-in app (/m).
 * Edits the same tamken3 fields as the Apex employee form (تفعيل تطبيق الجوال,
 * طريقة الحضور ∋ تطبيق الجوال), the employee's allowed «المواقع»
 * (pin + نطاق الموقع بالمتر), plus app passwords and registered phones.
 */
export function MobileAppSettingsPage() {
  const [tab, setTab] = useState<'employees' | 'locations' | 'tracking'>('employees')
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const appUrl = `${origin}/m`

  return (
    <div className="space-y-3" dir="rtl">
      <div className="bg-white rounded shadow-sm border border-slate-200/60 p-4 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--apex-blue)]/10 text-[var(--apex-blue)]">
            <Smartphone className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[17px] font-bold text-slate-800">تطبيق الجوال</h1>
            <p className="text-[12.5px] text-slate-500">البصمة من الجوال داخل نطاق مواقع العمل — تفعيل الموظفين ومواقعهم</p>
          </div>
        </div>
        {origin && (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--apex-border)] bg-slate-50 p-2 ps-3">
            <div className="text-[12.5px]">
              <p className="text-slate-500">رابط التطبيق للموظفين</p>
              <p dir="ltr" className="font-bold text-slate-800 text-left">{appUrl.replace(/^https?:\/\//, '')}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(appUrl)}
                className="mt-1 inline-flex items-center gap-1 text-[12px] text-[var(--apex-blue)] hover:underline"
              >
                <Copy className="h-3.5 w-3.5" />نسخ الرابط
              </button>
            </div>
            <QRCodeSVG value={appUrl} size={72} level="M" className="rounded bg-white p-1" aria-label="رمز QR لرابط التطبيق" />
          </div>
        )}
      </div>

      <div className="bg-white rounded shadow-sm border border-slate-200/60">
        <div className="flex border-b border-slate-200 px-2">
          {([['employees', 'الموظفون'], ['locations', 'المواقع ونطاقها'], ['tracking', 'تتبع الموقع']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn('relative px-5 h-11 text-[13.5px] font-bold', tab === id ? 'text-[var(--apex-blue)]' : 'text-slate-500 hover:text-slate-700')}
            >
              {label}
              {tab === id && <span className="absolute bottom-0 right-0 left-0 h-[3px] bg-[var(--apex-blue)]" />}
            </button>
          ))}
        </div>
        {tab === 'employees' ? <EmployeesTab /> : tab === 'locations' ? <LocationsTab /> : <TrackingTab />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// الموظفون
// ═══════════════════════════════════════════════════════════════════════════

function EmployeesTab() {
  const { toast } = useToast()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [loc, setLoc] = useState('')
  const [only, setOnly] = useState<'' | 'enabled' | 'disabled'>('')
  const [saving, setSaving] = useState('')
  const [menu, setMenu] = useState<string | null>(null)
  const [pwFor, setPwFor] = useState<EmpRow | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'devices' | 'disable'; row: EmpRow } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await call<Overview>(`${APP}.hr_overview`))
      setError('')
    } catch (e: any) {
      setError(sessionHint(e))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.employees || []).filter((r) => {
      if (loc === '__none' ? r.locations.length : loc && !r.locations.includes(loc)) return false
      if (only === 'enabled' && !(r.app_enabled && r.punch_enabled)) return false
      if (only === 'disabled' && r.app_enabled && r.punch_enabled) return false
      if (!q) return true
      return r.employee_name.toLowerCase().includes(q) || String(r.number).includes(q) || r.employee.toLowerCase().includes(q)
    })
  }, [data, search, loc, only])

  const stats = useMemo(() => {
    const e = data?.employees || []
    const ready = e.filter((r) => r.app_enabled && r.punch_enabled && r.usable_locations > 0 && r.has_account)
    return {
      enabled: e.filter((r) => r.app_enabled && r.punch_enabled).length,
      ready: ready.length,
      noLoc: e.filter((r) => r.app_enabled && r.punch_enabled && r.usable_locations === 0).length,
      devices: e.reduce((s, r) => s + r.passkeys, 0),
    }
  }, [data])

  const save = async (row: EmpRow, patch: Record<string, any>) => {
    setSaving(row.employee)
    // optimistic
    setData((d) => d && { ...d, employees: d.employees.map((r) => (r.employee === row.employee ? { ...r, ...uiPatch(patch, d) } : r)) })
    try {
      await call(`${APP}.hr_save_employee`, { employee: row.employee, ...patch })
    } catch (e: any) {
      toast({ title: 'لم يتم الحفظ', description: sessionHint(e), variant: 'destructive' })
      load()
    } finally {
      setSaving('')
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      if (confirm.kind === 'devices') {
        const r = await call<{ disabled: number }>(`${APP}.hr_reset_devices`, { employee: confirm.row.employee })
        toast({ title: 'تمت إعادة تعيين الأجهزة', description: `أُلغي تسجيل ${r.disabled} جهاز — يسجّل الموظف جهازه من جديد عند الدخول` })
      } else {
        await call(`${APP}.hr_disable_account`, { employee: confirm.row.employee })
        toast({ title: 'تم إيقاف حساب التطبيق' })
      }
      setConfirm(null)
      load()
    } catch (e: any) {
      toast({ title: 'تعذّر التنفيذ', description: e?.message, variant: 'destructive' })
    } finally {
      setConfirmBusy(false)
    }
  }

  if (error) {
    return (
      <div className="m-4 flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0" />{error}
      </div>
    )
  }
  if (!data) return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <Kpi label="مفعّل لهم البصمة من الجوال" value={stats.enabled} />
        <Kpi label="جاهزون للبصمة" hint="حساب + موقع" value={stats.ready} tone="green" />
        <Kpi label="بدون موقع صالح" value={stats.noLoc} tone={stats.noLoc ? 'orange' : undefined} />
        <Kpi label="أجهزة مسجّلة" value={stats.devices} />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الموظف أو رقمه"
            className="h-9 w-64 rounded border border-[var(--apex-border)] bg-white ps-8 pe-2 text-[13px] outline-none focus:border-[var(--apex-blue)]"
          />
        </div>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className="h-9 rounded border border-[var(--apex-border)] bg-white px-2 text-[13px] min-w-[170px]" aria-label="الموقع">
          <option value="">كل المواقع</option>
          <option value="__none">بدون موقع</option>
          {data.locations.map((l) => <option key={l.name} value={l.name}>{l.label}</option>)}
        </select>
        <select value={only} onChange={(e) => setOnly(e.target.value as any)} className="h-9 rounded border border-[var(--apex-border)] bg-white px-2 text-[13px]" aria-label="الحالة">
          <option value="">كل الموظفين</option>
          <option value="enabled">المفعّل لهم البصمة من الجوال</option>
          <option value="disabled">غير المفعّل لهم</option>
        </select>
        <div className="ms-auto flex gap-2 text-[12.5px]">
          <Link href="/hr?module=locations" className="rounded border border-[var(--apex-slate)] px-3 h-9 inline-flex items-center gap-1.5 font-bold text-[var(--apex-slate)] hover:bg-slate-50">
            <MapPin className="h-4 w-4" />المواقع
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] text-right">
          <thead>
            <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
              <th className="px-3 font-bold whitespace-nowrap">الموظف</th>
              <th className="px-3 font-bold whitespace-nowrap">الفرع</th>
              <th className="px-3 font-bold whitespace-nowrap text-center">تفعيل تطبيق الجوال</th>
              <th className="px-3 font-bold whitespace-nowrap text-center">البصمة من الجوال</th>
              <th className="px-3 font-bold whitespace-nowrap">مواقع البصمة</th>
              <th className="px-3 font-bold whitespace-nowrap">تتبع الموقع أثناء الدوام</th>
              <th className="px-3 font-bold whitespace-nowrap">حساب التطبيق</th>
              <th className="px-3 font-bold whitespace-nowrap text-center">الأجهزة</th>
              <th className="px-3 font-bold whitespace-nowrap">آخر بصمة جوال</th>
              <th className="px-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-10 text-center text-slate-400">لا يوجد موظفون مطابقون</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.employee} className="border-b border-slate-200 hover:bg-slate-50/60 h-12">
                <td className="px-3">
                  <p className="font-bold text-slate-800">{r.employee_name}</p>
                  <p className="text-[11.5px] text-slate-500 tabular-nums">{r.number}</p>
                </td>
                <td className="px-3 text-slate-600">{r.branch || '—'}</td>
                <td className="px-3 text-center">
                  <Switch
                    dir="ltr"
                    checked={r.app_enabled}
                    disabled={saving === r.employee}
                    onCheckedChange={(v) => save(r, { app_enabled: v ? 1 : 0 })}
                    aria-label={`تفعيل تطبيق الجوال — ${r.employee_name}`}
                  />
                </td>
                <td className="px-3 text-center">
                  <Switch
                    dir="ltr"
                    checked={r.punch_enabled}
                    disabled={saving === r.employee}
                    onCheckedChange={(v) => save(r, { punch_enabled: v ? 1 : 0 })}
                    aria-label={`البصمة من الجوال — ${r.employee_name}`}
                  />
                </td>
                <td className="px-3">
                  <LocationsPicker
                    value={r.locations}
                    options={data.locations}
                    disabled={saving === r.employee}
                    warn={r.punch_enabled && r.usable_locations === 0}
                    label={`مواقع البصمة — ${r.employee_name}`}
                    onChange={(names) => save(r, { locations: names })}
                  />
                </td>
                <td className="px-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      dir="ltr"
                      checked={r.tracking_enabled}
                      disabled={saving === r.employee}
                      onCheckedChange={(v) => save(r, { tracking_enabled: v ? 1 : 0 })}
                      aria-label={`تتبع الموقع — ${r.employee_name}`}
                    />
                    {r.tracking_enabled && (
                      <>
                        <select
                          value={r.tracking_interval}
                          disabled={saving === r.employee}
                          onChange={(e) => save(r, { tracking_interval: Number(e.target.value) })}
                          className="h-8 rounded border border-[var(--apex-border)] bg-white px-1 text-[12.5px]"
                          aria-label={`فترة التتبع — ${r.employee_name}`}
                        >
                          {TRACK_INTERVALS.map((m) => <option key={m} value={m}>كل {m} د</option>)}
                        </select>
                        {!r.tracking_consent && (
                          <span title="يوافق الموظف من التطبيق قبل بدء التتبع" className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            بانتظار موافقته
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-3">
                  {r.has_account ? (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-emerald-700">مفعّل</span>
                  ) : (
                    <button type="button" onClick={() => setPwFor(r)} className="whitespace-nowrap text-[12.5px] font-bold text-[var(--apex-blue)] hover:underline">
                      إنشاء كلمة مرور
                    </button>
                  )}
                </td>
                <td className="px-3 text-center tabular-nums">{r.passkeys || '—'}</td>
                <td className="px-3 text-slate-600 tabular-nums whitespace-nowrap">{r.last_app_punch ? r.last_app_punch.slice(0, 16) : '—'}</td>
                <td className="px-3 relative">
                  <button
                    type="button"
                    onClick={() => setMenu(menu === r.employee ? null : r.employee)}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100"
                    aria-label="إجراءات"
                  >
                    {saving === r.employee ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                  </button>
                  {menu === r.employee && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                      <div className="absolute end-3 top-10 z-20 w-56 rounded border border-slate-200 bg-white py-1 text-[13px] shadow-lg">
                        <MenuItem icon={<KeyRound className="h-4 w-4" />} onClick={() => { setMenu(null); setPwFor(r) }}>
                          {r.has_account ? 'إعادة تعيين كلمة المرور' : 'إنشاء كلمة مرور للتطبيق'}
                        </MenuItem>
                        <MenuItem icon={<RotateCcw className="h-4 w-4" />} disabled={!r.passkeys} onClick={() => { setMenu(null); setConfirm({ kind: 'devices', row: r }) }}>
                          إعادة تعيين الأجهزة المسجّلة
                        </MenuItem>
                        <MenuItem icon={<UserX className="h-4 w-4" />} danger disabled={!r.app_enabled} onClick={() => { setMenu(null); setConfirm({ kind: 'disable', row: r }) }}>
                          إيقاف حساب التطبيق
                        </MenuItem>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PasswordDialog row={pwFor} onClose={() => setPwFor(null)} onDone={load} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === 'devices' ? 'إعادة تعيين الأجهزة المسجّلة' : 'إيقاف حساب التطبيق'}
        description={
          confirm?.kind === 'devices'
            ? `سيُلغى تسجيل كل أجهزة ${confirm.row.employee_name}، وسيُطلب منه تسجيل جهازه الجديد عند الدخول.`
            : `لن يستطيع ${confirm?.row.employee_name} الدخول إلى التطبيق أو البصمة منه حتى يُعاد تفعيله.`
        }
        confirmLabel="تأكيد"
        cancelLabel="إلغاء"
        loading={confirmBusy}
        onConfirm={runConfirm}
      />
    </div>
  )
}

function uiPatch(patch: Record<string, any>, d: Overview): Partial<EmpRow> {
  const out: Partial<EmpRow> = {}
  if ('app_enabled' in patch) out.app_enabled = !!patch.app_enabled
  if ('punch_enabled' in patch) out.punch_enabled = !!patch.punch_enabled
  if ('tracking_enabled' in patch) out.tracking_enabled = !!patch.tracking_enabled
  if ('tracking_interval' in patch) out.tracking_interval = patch.tracking_interval
  if ('locations' in patch) {
    const names: string[] = patch.locations
    out.locations = names
    out.usable_locations = names.filter((n) => d.locations.find((l) => l.name === n)?.usable).length
  }
  return out
}

function PasswordDialog({ row, onClose, onDone }: { row: EmpRow | null; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ username: string; password: string } | null>(null)

  useEffect(() => {
    if (row) {
      setPw(randomPassword())
      setErr('')
      setDone(null)
    }
  }, [row])

  const submit = async () => {
    if (!row) return
    if (pw.length < 6) return setErr('كلمة المرور يجب ألا تقل عن 6 أحرف')
    setBusy(true)
    setErr('')
    try {
      const r = await call<{ username: string }>(`${APP}.hr_set_app_password`, { employee: row.employee, password: pw })
      setDone({ username: r.username, password: pw })
      onDone()
    } catch (e: any) {
      setErr(e?.message || 'تعذّر الحفظ')
    } finally {
      setBusy(false)
    }
  }

  const share = done ? `تطبيق البصمة: ${window.location.origin}/m\nرقم الموظف: ${done.username}\nكلمة المرور: ${done.password}` : ''

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">كلمة مرور التطبيق — {row?.employee_name}</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="space-y-3 text-[13.5px]">
            <p className="text-emerald-700 font-bold">تم الحفظ. سلّم الموظف بيانات الدخول التالية:</p>
            <pre dir="rtl" className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 font-[inherit] leading-7">{share}</pre>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigator.clipboard?.writeText(share)} className="flex-1 h-9 rounded bg-[var(--apex-blue)] text-white font-bold inline-flex items-center justify-center gap-1.5">
                <Copy className="h-4 w-4" />نسخ
              </button>
              <button type="button" onClick={onClose} className="flex-1 h-9 rounded border border-slate-300 font-bold">إغلاق</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-[13.5px]">
            <p className="text-slate-600">
              يدخل الموظف إلى التطبيق برقم الموظف <b className="tabular-nums">{row?.number}</b> وكلمة المرور التالية، ويمكنه تغييرها لاحقاً من «حسابي».
            </p>
            <div className="flex gap-2">
              <input dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} className="h-10 flex-1 rounded border border-[var(--apex-border)] px-3 text-left font-mono outline-none focus:border-[var(--apex-blue)]" aria-label="كلمة المرور" />
              <button type="button" onClick={() => setPw(randomPassword())} className="h-10 rounded border border-slate-300 px-3 font-bold text-slate-600">توليد</button>
            </div>
            {err && <p className="text-red-600">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={submit} disabled={busy} className="flex-1 h-9 rounded bg-[var(--apex-green)] text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}حفظ وتفعيل
              </button>
              <button type="button" onClick={onClose} className="flex-1 h-9 rounded border border-slate-300 font-bold">إلغاء</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const a = new Uint32Array(8)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => chars[n % chars.length]).join('')
}

// ═══════════════════════════════════════════════════════════════════════════
// المواقع ونطاقها
// ═══════════════════════════════════════════════════════════════════════════

function LocationsTab() {
  const { toast } = useToast()
  const [rows, setRows] = useState<LocRow[] | null>(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<Partial<LocRow> | null>(null)

  const load = useCallback(async () => {
    try {
      setRows((await call<LocRow[]>(`${LOC}.list_locations`)) || [])
    } catch (e: any) {
      setError(sessionHint(e))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  if (error) return <p className="m-4 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">{error}</p>
  if (!rows) return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>

  return (
    <div>
      <div className="flex items-center justify-between gap-2 p-4">
        <p className="text-[12.5px] text-slate-500">
          يُقبل تسجيل الموظف من الجوال إذا كان داخل نطاق أحد مواقعه <b>النشطة</b> — تُحدَّد مواقع كل موظف من تبويب «الموظفون».
        </p>
        <button
          type="button"
          onClick={() => setEdit({ custom_radius_m: 100, custom_status: 'Active' })}
          className="rounded px-4 h-9 font-bold text-[13px] bg-[var(--apex-green)] text-white inline-flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" />اضافة موقع
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] text-right">
          <thead>
            <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
              <th className="px-3 font-bold">اسم الموقع</th>
              <th className="px-3 font-bold">الإحداثيات</th>
              <th className="px-3 font-bold">نطاق الموقع بالمتر</th>
              <th className="px-3 font-bold">الحالة</th>
              <th className="px-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-slate-400">لا توجد مواقع بعد — أضف أول موقع عمل</td></tr>}
            {rows.map((r) => {
              const pinned = !!(r.latitude && r.longitude)
              return (
                <tr key={r.name} className="border-b border-slate-200 h-12 hover:bg-slate-50/60">
                  <td className="px-3 font-bold text-slate-800">{r.location_name}</td>
                  <td className="px-3 tabular-nums" dir="ltr">
                    {pinned ? (
                      <span className="text-slate-600">{Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}</span>
                    ) : (
                      <span className="text-amber-600 font-bold">غير محدد على الخريطة</span>
                    )}
                  </td>
                  <td className="px-3 tabular-nums">{r.custom_radius_m || 100}</td>
                  <td className="px-3">
                    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-bold', r.custom_status === 'Inactive' ? 'text-slate-400' : 'text-emerald-700')}>
                      <span className={cn('h-2 w-2 rounded-full', r.custom_status === 'Inactive' ? 'bg-slate-300' : 'bg-emerald-500')} />
                      {r.custom_status === 'Inactive' ? 'غير نشط' : 'نشط'}
                    </span>
                  </td>
                  <td className="px-3">
                    <button type="button" onClick={() => setEdit(r)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100" aria-label={`تعديل ${r.location_name}`}>
                      <Pencil className="h-4 w-4 text-[var(--apex-blue)]" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <LocationDialog
        value={edit}
        others={(rows || []).filter((r) => r.name !== edit?.name)}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null)
          toast({ title: 'تم حفظ الموقع' })
          load()
        }}
      />
    </div>
  )
}

function LocationDialog({
  value, others, onClose, onSaved,
}: {
  value: Partial<LocRow> | null
  others: LocRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState<Partial<LocRow>>({})
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [err, setErr] = useState('')
  const [coordsText, setCoordsText] = useState('')

  useEffect(() => {
    if (value) {
      setF(value)
      setErr('')
      setCoordsText(value.latitude && value.longitude ? `${value.latitude}, ${value.longitude}` : '')
    }
  }, [value])

  const pin = f.latitude && f.longitude ? { latitude: Number(f.latitude), longitude: Number(f.longitude) } : null
  const radius = Number(f.custom_radius_m) || 100

  const setPin = (lat: number, lon: number) => {
    const la = Number(lat.toFixed(6))
    const lo = Number(lon.toFixed(6))
    setF((p) => ({ ...p, latitude: la, longitude: lo }))
    setCoordsText(`${la}, ${lo}`)
  }

  const fromText = (t: string) => {
    setCoordsText(t)
    const m = t.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,،\s]\s*(-?\d{1,3}(?:\.\d+)?)/)
    if (m) {
      const la = Number(m[1])
      const lo = Number(m[2])
      if (Math.abs(la) <= 90 && Math.abs(lo) <= 180) setF((p) => ({ ...p, latitude: la, longitude: lo }))
    }
  }

  const useMine = () => {
    if (!navigator.geolocation) return setErr('تحديد الموقع غير متاح في هذا المتصفح')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPin(p.coords.latitude, p.coords.longitude)
        setLocating(false)
      },
      () => {
        setErr('تعذّر تحديد موقعك الحالي')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const submit = async () => {
    if (!f.location_name?.trim()) return setErr('اسم الموقع مطلوب')
    if (!pin) return setErr('حدد الموقع على الخريطة')
    if (radius < 20 || radius > 20000) return setErr('نطاق الموقع بين 20 و 20000 متر')
    setBusy(true)
    setErr('')
    try {
      await call(`${LOC}.save_location`, {
        name: f.name || undefined,
        location_name: f.location_name.trim(),
        latitude: pin.latitude,
        longitude: pin.longitude,
        custom_radius_m: radius,
        custom_status: f.custom_status || 'Active',
        custom_name_en: f.custom_name_en ?? undefined,
      })
      onSaved()
    } catch (e: any) {
      setErr(sessionHint(e))
    } finally {
      setBusy(false)
    }
  }

  const input = 'h-9 w-full rounded border border-[var(--apex-border)] bg-white px-2 text-[13px] outline-none focus:border-[var(--apex-blue)]'

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{f.name ? `تعديل الموقع — ${f.location_name}` : 'اضافة موقع'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[260px_1fr] text-[13px]">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block font-bold text-slate-700">اسم الموقع *</span>
              <input value={f.location_name || ''} onChange={(e) => setF((p) => ({ ...p, location_name: e.target.value }))} className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block font-bold text-slate-700">الإحداثيات (خط العرض، خط الطول)</span>
              <input dir="ltr" value={coordsText} onChange={(e) => fromText(e.target.value)} placeholder="24.713600, 46.675300" className={cn(input, 'text-left tabular-nums')} />
              <span className="mt-1 block text-[11.5px] text-slate-500">اضغط على الخريطة أو الصق الإحداثيات من خرائط Google</span>
            </label>
            <button type="button" onClick={useMine} disabled={locating} className="h-9 w-full rounded border border-[var(--apex-slate)] font-bold text-[var(--apex-slate)] inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}استخدم موقعي الحالي
            </button>
            <label className="block">
              <span className="mb-1 flex justify-between font-bold text-slate-700">
                نطاق الموقع بالمتر <span className="tabular-nums text-[var(--apex-blue)]">{radius} م</span>
              </span>
              <input type="range" min={20} max={1000} step={10} value={Math.min(radius, 1000)} onChange={(e) => setF((p) => ({ ...p, custom_radius_m: Number(e.target.value) }))} className="w-full accent-[var(--apex-blue)]" dir="ltr" aria-label="نطاق الموقع" />
              <input type="number" min={20} max={20000} value={radius} onChange={(e) => setF((p) => ({ ...p, custom_radius_m: Number(e.target.value) }))} className={cn(input, 'mt-1 tabular-nums')} aria-label="نطاق الموقع بالمتر" />
            </label>
            <label className="flex items-center justify-between rounded border border-[var(--apex-border)] px-3 h-10">
              <span className="font-bold text-slate-700">نشط</span>
              <Switch dir="ltr" checked={(f.custom_status || 'Active') === 'Active'} onCheckedChange={(v) => setF((p) => ({ ...p, custom_status: v ? 'Active' : 'Inactive' }))} />
            </label>
          </div>
          <div className="min-h-[340px] overflow-hidden rounded border border-[var(--apex-border)]">
            {value && <LocationPickerMap className="h-full min-h-[340px] w-full" value={pin} radius={radius} onPick={setPin} others={others} />}
          </div>
        </div>
        {err && <p className="text-[13px] text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={submit} disabled={busy} className="h-9 rounded bg-[var(--apex-green)] px-6 text-[13px] font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}حفظ
          </button>
          <button type="button" onClick={onClose} className="h-9 rounded border border-slate-300 px-6 text-[13px] font-bold">إلغاء</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── small bits ─────────────────────────────────────────────────────────────

/** A 403 here almost always means this browser's session was replaced by an
 *  employee signing in to «/m» — one browser holds one session per site. */
function sessionHint(e: any): string {
  const msg = e?.message || ''
  if (e?.status === 403 || /HR access required|صلاحية الموارد البشرية/.test(msg)) {
    return 'جلسة هذا المتصفح ليست لحساب إداري — غالباً بسبب تسجيل دخول موظف من تطبيق الجوال في نفس المتصفح. سجّل الدخول بحساب المدير مرة أخرى (واستخدم نافذة خاصة لتجربة التطبيق).'
  }
  return msg || 'حدث خطأ غير متوقع'
}

function LocationsPicker({
  value, options, onChange, disabled, warn, label,
}: {
  value: string[]
  options: { name: string; label: string; usable: boolean }[]
  onChange: (names: string[]) => void
  disabled?: boolean
  warn?: boolean
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(value)
  useEffect(() => setDraft(value), [value])
  const labelOf = (n: string) => options.find((o) => o.name === n)?.label || n
  const close = () => {
    setOpen(false)
    if (draft.join(',') !== value.join(',')) onChange(draft)
  }
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={label}
        aria-expanded={open}
        className={cn(
          'flex h-8 min-w-[170px] max-w-[240px] items-center justify-between gap-2 rounded border bg-white px-2 text-[12.5px] disabled:opacity-60',
          warn ? 'border-amber-400' : 'border-[var(--apex-border)]',
        )}
      >
        <span className={cn('truncate', !value.length && 'text-slate-400')}>
          {value.length ? value.map(labelOf).join('، ') : '— بدون —'}
        </span>
        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute start-0 top-9 z-20 w-60 rounded border border-slate-200 bg-white py-1 text-[13px] shadow-lg">
            {options.length === 0 && (
              <p className="px-3 py-2 text-slate-500">لا توجد مواقع — أضفها من تبويب «المواقع ونطاقها»</p>
            )}
            {options.map((o) => (
              <label key={o.name} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={draft.includes(o.name)}
                  onChange={(e) => setDraft((d) => (e.target.checked ? [...d, o.name] : d.filter((x) => x !== o.name)))}
                  className="h-4 w-4 accent-[var(--apex-blue-light)]"
                />
                <span className="flex-1">{o.label}</span>
                {!o.usable && <span className="text-[11px] text-amber-600">غير مفعّل</span>}
              </label>
            ))}
            {options.length > 0 && (
              <div className="border-t border-slate-100 px-2 pt-1">
                <button type="button" onClick={close} className="h-8 w-full rounded bg-[var(--apex-blue)] text-[12.5px] font-bold text-white">تم</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: 'green' | 'orange' }) {
  return (
    <div className={cn('rounded border p-3', tone === 'orange' ? 'border-amber-200 bg-amber-50' : tone === 'green' ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/60')}>
      <p className="text-[12px] text-slate-500">{label}{hint ? <span className="text-slate-400"> · {hint}</span> : null}</p>
      <p className={cn('mt-1 text-[22px] font-bold tabular-nums', tone === 'orange' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-800')}>{value}</p>
    </div>
  )
}

function MenuItem({ icon, children, onClick, disabled, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('flex w-full items-center gap-2 px-3 py-2 text-right hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent', danger ? 'text-[var(--apex-red)]' : 'text-slate-700')}
    >
      {icon}{children}
    </button>
  )
}
