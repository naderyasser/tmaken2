'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2, Download, Fingerprint, KeyRound, Loader2, LogOut, MapPin, Plus, Share, Smartphone, Trash2,
} from 'lucide-react'

import { useHome } from '@/components/m/use-home'
import { useInstall } from '@/components/m/use-install'
import { errorText, mcall } from '@/lib/m/api'
import { isPasskeySupported, listMyPasskeys, registerPasskey, revokePasskey, type PasskeyRow } from '@/lib/mobile-attendance/webauthn'

export default function MobileProfilePage() {
  const { data } = useHome()
  const install = useInstall()

  const logout = async () => {
    try {
      await fetch('/api/method/logout', { credentials: 'include' })
    } finally {
      window.location.replace('/m/login')
    }
  }

  return (
    <>
      <header className="bg-gradient-to-b from-[#1d4d56] to-[#163d44] px-5 pb-6 pt-[max(18px,env(safe-area-inset-top))] text-white">
        <h1 className="text-[20px] font-bold">حسابي</h1>
        {data && (
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-[22px] font-bold">
              {data.employee.employee_name.trim().charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold">{data.employee.employee_name}</p>
              <p className="text-[13px] text-white/70">
                رقم الموظف <span className="tabular-nums">{data.employee.number}</span>
                {data.employee.designation ? ` · ${data.employee.designation}` : ''}
              </p>
            </div>
          </div>
        )}
      </header>

      <div className="space-y-4 px-4 py-4">
        {data && (
          <Card>
            <Row icon={<Building2 className="h-[18px] w-[18px]" />} label="الفرع" value={data.employee.branch || '—'} />
            <Row icon={<MapPin className="h-[18px] w-[18px]" />} label="مواقع البصمة" value={data.locations.map((l) => l.label).join('، ') || 'غير محددة'} />
            <Row
              icon={<Fingerprint className="h-[18px] w-[18px]" />}
              label="البصمة من الجوال"
              value={data.punch_enabled ? 'مفعّلة' : 'غير مفعّلة'}
              last
            />
          </Card>
        )}

        <Devices />

        {!install.standalone && (
          <Card>
            <div className="flex gap-3 p-4">
              <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-[#24817f]" />
              <div className="flex-1">
                <p className="text-[15px] font-bold">ثبّت التطبيق على جوالك</p>
                {install.canPrompt ? (
                  <button
                    onClick={install.install}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#24817f] text-[14.5px] font-bold text-white"
                  >
                    <Download className="h-[18px] w-[18px]" />
                    تثبيت
                  </button>
                ) : install.ios ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-[#5b7a7f]">
                    من Safari اضغط <Share className="inline h-4 w-4 align-[-3px]" /> «مشاركة» ثم «إضافة إلى الشاشة الرئيسية».
                  </p>
                ) : (
                  <p className="mt-1 text-[13px] leading-relaxed text-[#5b7a7f]">
                    من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        <ChangePassword />

        <button
          onClick={logout}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#f3d2cc] bg-white text-[15px] font-bold text-[#c2410c]"
        >
          <LogOut className="h-5 w-5" />
          تسجيل الخروج
        </button>
      </div>
    </>
  )
}

function Devices() {
  const [rows, setRows] = useState<PasskeyRow[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(((await listMyPasskeys()) || []).filter((r) => !r.disabled))
    } catch (e) {
      setError(errorText(e))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    setBusy('add')
    setError('')
    try {
      await registerPasskey(/iphone/i.test(navigator.userAgent) ? 'iPhone' : /android/i.test(navigator.userAgent) ? 'Android' : 'متصفح')
      await load()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy('')
    }
  }

  const remove = async (name: string) => {
    setBusy(name)
    setError('')
    try {
      await revokePasskey(name)
      await load()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="text-[15px] font-bold">الأجهزة المسجّلة للبصمة</p>
        {isPasskeySupported() && (
          <button
            onClick={add}
            disabled={!!busy}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#e6f4f2] px-3 text-[13px] font-bold text-[#24817f] disabled:opacity-60"
          >
            {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            هذا الجهاز
          </button>
        )}
      </div>
      <div className="px-4 pb-4 pt-2">
        {rows === null && !error && <div className="h-10 animate-pulse rounded-lg bg-[#eef3f3]" />}
        {rows?.length === 0 && <p className="py-2 text-[13px] text-[#7b9396]">لم يُسجَّل أي جهاز بعد</p>}
        <ul className="divide-y divide-[#eef3f3]">
          {rows?.map((r) => (
            <li key={r.name} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-[14px] font-semibold">{r.device_label || 'جهاز'}</p>
                <p className="text-[12px] text-[#7b9396]">
                  {r.last_used_on ? `آخر استخدام ${r.last_used_on.slice(0, 16)}` : `أُضيف ${String(r.created_on || '').slice(0, 10)}`}
                </p>
              </div>
              <button
                onClick={() => remove(r.name)}
                disabled={!!busy}
                aria-label="إزالة الجهاز"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#c2410c] hover:bg-[#fdf0ec] disabled:opacity-50"
              >
                {busy === r.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="mt-2 text-[13px] text-[#a1621a]">{error}</p>}
      </div>
    </Card>
  )
}

function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 6) return setMsg({ ok: false, text: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف' })
    if (newPw !== confirm) return setMsg({ ok: false, text: 'تأكيد كلمة المرور غير مطابق' })
    setBusy(true)
    setMsg(null)
    try {
      await mcall('change_password', { old_password: oldPw, new_password: newPw })
      setMsg({ ok: true, text: 'تم تغيير كلمة المرور' })
      setOldPw('')
      setNewPw('')
      setConfirm('')
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  const input = 'h-11 w-full rounded-xl border border-[#dbe5e6] bg-[#f7fafa] px-3 text-[15px] outline-none focus:border-[#2c9c9a] focus:ring-2 focus:ring-[#2c9c9a]/20'
  return (
    <Card>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-start" aria-expanded={open}>
        <KeyRound className="h-5 w-5 text-[#2f7480]" />
        <span className="flex-1 text-[15px] font-bold">تغيير كلمة المرور</span>
      </button>
      {open && (
        <form onSubmit={submit} className="space-y-3 px-4 pb-4">
          <input type="password" autoComplete="current-password" placeholder="كلمة المرور الحالية" value={oldPw} onChange={(e) => setOldPw(e.target.value)} className={input} />
          <input type="password" autoComplete="new-password" placeholder="كلمة المرور الجديدة" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={input} />
          <input type="password" autoComplete="new-password" placeholder="تأكيد كلمة المرور الجديدة" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
          {msg && <p className={`text-[13px] ${msg.ok ? 'text-[#2f9e6f]' : 'text-[#a1621a]'}`}>{msg.text}</p>}
          <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d4d56] text-[14.5px] font-bold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ
          </button>
        </form>
      )}
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_-18px_rgba(15,42,47,.5)]">{children}</section>
}

function Row({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-[#eef3f3]'}`}>
      <span className="text-[#2f7480]">{icon}</span>
      <span className="flex-1 text-[14px] text-[#5b7a7f]">{label}</span>
      <span className="text-[14px] font-semibold">{value}</span>
    </div>
  )
}
