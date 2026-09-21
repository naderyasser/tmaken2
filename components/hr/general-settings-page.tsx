'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Loader2, Paperclip } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

const FIELD = 'w-full h-[42px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 outline-none focus:border-[var(--apex-blue)]'

function Accordion({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-md shadow-sm border border-slate-200/70 mb-5">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-6 h-[70px] text-[20px] font-bold text-slate-800">
        <span>{title}</span>
        {open ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

function SaveBtn({ onClick, busy, label = 'حفظ' }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="h-[40px] px-4 rounded bg-[var(--apex-green)] text-white text-[14px] flex items-center gap-2 hover:bg-[var(--apex-green-dark)] disabled:opacity-60">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {label}
    </button>
  )
}

/**
 * «الاعدادات العامة» — Apex: three accordions (السنة المالية · اعدادات البريد
 * الالكتروني · اخري). Reads/writes through base_meena.api.hr_settings.
 */
export function GeneralSettingsPage() {
  const { toast } = useToast()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [fy, setFy] = useState({ start: '', end: '' })
  const [em, setEm] = useState({ email_id: '', password: '', smtp_server: '', display_name: '', port: '0', secure: 'آلى', has_password: false })
  const [testTo, setTestTo] = useState('')
  // A single shared `busy: string | null` used to mean only one save button on
  // this whole page could ever show "loading" at a time — saving one field
  // (e.g. العلامات العشرية) while a DIFFERENT field's save was still in
  // flight (e.g. الوقت المسموح للجلسة, right below it) silently stole the
  // other one's spinner: whichever request's `finally` ran last just set the
  // single shared slot back to null, so the FIRST field's button could get
  // stuck showing a spinner forever if a second save started and finished
  // before it did (its own `finally` had nothing left to clear once the
  // shared slot no longer held its key) — the save itself always went through
  // fine server-side, only the UI's own busy/toast bookkeeping desynced.
  // Found live, 2026-09-21. A Set of independently-tracked keys removes the
  // possibility of one button's loading state ever depending on another's.
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set())
  const startBusy = (key: string) => setBusyKeys((s) => new Set(s).add(key))
  const stopBusy = (key: string) => setBusyKeys((s) => { const next = new Set(s); next.delete(key); return next })
  // 5.23 «اخري»: real System Settings fields (Apex parity item A2, 2026-09-21) —
  // decimal_places is Frappe's own float_precision (every flt() rounding in the
  // app already respects it) and session_timeout_minutes is session_expiry
  // (Frappe's own idle-session cutoff, enforced on every request — nothing extra
  // to wire up client-side for either one to actually take effect).
  const [other, setOther] = useState({ decimal_places: '2', session_timeout_minutes: '15' })
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  useEffect(() => {
    frappeClient.call<any>('base_meena.api.hr_settings.get_general_settings')
      .then((r: any) => {
        const d = r?.message ?? {}
        if (d.fiscal) setFy({ start: d.fiscal.start, end: d.fiscal.end })
        if (d.email) setEm((e) => ({ ...e, ...d.email, port: String(d.email.port ?? 0), password: '' }))
        if (d.other) setOther({ decimal_places: String(d.other.decimal_places ?? 2), session_timeout_minutes: String(d.other.session_timeout_minutes ?? 15) })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    startBusy(key)
    try { await fn(); toast({ title: ok }) }
    catch (e: any) { toast({ title: 'فشل', description: e?.message, variant: 'destructive' }) }
    finally { stopBusy(key) }
  }

  const ddmmyyyy = (iso: string) => iso ? iso.split('-').reverse().join('/') : ''

  const testEmailConnection = async () => {
    startBusy('test-conn')
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_settings.test_email_settings')
      const res = r?.message ?? {}
      toast(res.ok ? { title: res.message } : { title: 'فشل', description: res.message, variant: 'destructive' })
    } catch (e: any) {
      toast({ title: 'فشل', description: e?.message, variant: 'destructive' })
    } finally {
      stopBusy('test-conn')
    }
  }

  const sendTestEmail = async () => {
    startBusy('test')
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_settings.send_test_email', { to: testTo })
      const res = r?.message ?? {}
      toast(res.ok ? { title: res.message } : { title: 'فشل', description: res.message, variant: 'destructive' })
    } catch (e: any) {
      toast({ title: 'فشل', description: e?.message, variant: 'destructive' })
    } finally {
      stopBusy('test')
    }
  }

  return (
    <div className="p-4 pt-6" dir="rtl">
      <Accordion title="السنة المالية" open={!!open.fy} onToggle={() => toggle('fy')}>
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-[var(--apex-blue)]" /> : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <span className="block text-[15px] text-slate-800 mb-2">بداية الفترة المالية</span>
                <input type="date" value={fy.start} onChange={(e) => setFy((f) => ({ ...f, start: e.target.value }))} className={FIELD} title={ddmmyyyy(fy.start)} />
              </div>
              <div>
                <span className="block text-[15px] text-slate-800 mb-2">نهاية الفترة المالية</span>
                <input type="date" value={fy.end} onChange={(e) => setFy((f) => ({ ...f, end: e.target.value }))} className={FIELD} title={ddmmyyyy(fy.end)} />
              </div>
            </div>
            <SaveBtn busy={busyKeys.has('fy')} onClick={() => run('fy', () => frappeClient.call('base_meena.api.hr_settings.save_fiscal_year', { start: fy.start, end: fy.end }), 'تم حفظ السنة المالية')} />
          </div>
        )}
      </Accordion>

      <Accordion title="اعدادات البريد الالكتروني" open={!!open.em} onToggle={() => toggle('em')}>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-5 max-w-4xl">
            <L label="البريد الالكتروني"><input value={em.email_id} onChange={(e) => setEm((s) => ({ ...s, email_id: e.target.value }))} className={FIELD} /></L>
            <L label="كلمة المرور"><input type="password" value={em.password} placeholder={em.has_password ? '••••••••' : ''} onChange={(e) => setEm((s) => ({ ...s, password: e.target.value }))} className={FIELD} /></L>
            <L label="اسم المضيف"><input value={em.smtp_server} onChange={(e) => setEm((s) => ({ ...s, smtp_server: e.target.value }))} className={FIELD} /></L>
            <L label="اسم الظهور"><input value={em.display_name} onChange={(e) => setEm((s) => ({ ...s, display_name: e.target.value }))} className={FIELD} /></L>
            <L label="المنفذ"><input type="number" value={em.port} onChange={(e) => setEm((s) => ({ ...s, port: e.target.value }))} className={FIELD} /></L>
            <L label="نوع الاتصال الآمن">
              <div className="relative">
                <select value={em.secure} onChange={(e) => setEm((s) => ({ ...s, secure: e.target.value }))} className={FIELD + ' appearance-none'}>
                  {['آلى', 'SSL', 'TLS'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              </div>
            </L>
          </div>
          <div className="flex items-center gap-3">
            <SaveBtn busy={busyKeys.has('em')} onClick={() => run('em', () => frappeClient.call('base_meena.api.hr_settings.save_email_settings', {
              email_id: em.email_id, smtp_server: em.smtp_server, display_name: em.display_name, port: em.port, secure: em.secure, password: em.password || undefined,
            }), 'تم حفظ إعدادات البريد')} />
            <button type="button" disabled={busyKeys.has('test-conn')} onClick={testEmailConnection} className="h-[40px] px-4 rounded border border-[var(--apex-blue)] text-[var(--apex-blue)] text-[14px] flex items-center gap-2 hover:bg-[var(--apex-blue)]/5 disabled:opacity-60">
              {busyKeys.has('test-conn') ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              اختبار الاتصال
            </button>
          </div>

          <div className="pt-4 space-y-4">
            <h4 className="text-[16px] text-slate-800">تجربه الارسال</h4>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-6 items-center max-w-4xl">
              <span className="text-[15px] text-slate-800">البريد الالكتروني</span>
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className={FIELD} />
              <div className="flex items-center gap-3">
                <a href="https://support.google.com/mail/answer/7126229" target="_blank" rel="noreferrer" className="text-[var(--apex-blue)] text-[14px] flex items-center gap-1"><Paperclip className="h-4 w-4" />اعدادات Gmail</a>
                <SaveBtn label="ارسال" busy={busyKeys.has('test')} onClick={sendTestEmail} />
              </div>
            </div>
          </div>
        </div>
      </Accordion>

      <Accordion title="اخري" open={!!open.other} onToggle={() => toggle('other')}>
        <div className="space-y-5 max-w-md">
          <div>
            <L label="العلامات العشرية">
              <div className="relative">
                <select
                  value={other.decimal_places}
                  onChange={(e) => setOther((s) => ({ ...s, decimal_places: e.target.value }))}
                  className={FIELD + ' appearance-none'}
                >
                  {['2', '3', '4', '5', '6', '7', '8', '9'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              </div>
            </L>
            <p className="text-[12.5px] text-slate-500 mt-1.5">
              عدد الخانات العشرية التي تُقرّب إليها الأرقام والمبالغ في كل شاشات النظام (مثال: عند 2 يظهر 10.456 كـ 10.46).
            </p>
            <SaveBtn
              busy={busyKeys.has('decimal-places')}
              onClick={() => run('decimal-places', () => frappeClient.call('base_meena.api.hr_settings.save_general_settings', { decimal_places: Number(other.decimal_places) }), 'تم الحفظ')}
            />
          </div>

          <div>
            <L label="الوقت المسموح للجلسة بالدقائق">
              <input
                type="number"
                min={1}
                value={other.session_timeout_minutes}
                onChange={(e) => setOther((s) => ({ ...s, session_timeout_minutes: e.target.value }))}
                className={FIELD}
              />
            </L>
            <p className="text-[12.5px] text-slate-500 mt-1.5">
              يتم تسجيل خروج المستخدم تلقائياً بعد هذه المدة من عدم النشاط.
            </p>
            <SaveBtn
              busy={busyKeys.has('session-timeout')}
              onClick={() => run('session-timeout', () => frappeClient.call('base_meena.api.hr_settings.save_general_settings', { session_timeout_minutes: Number(other.session_timeout_minutes) }), 'تم الحفظ')}
            />
          </div>
        </div>
      </Accordion>
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[15px] text-slate-800 mb-2">{label}</span>
      {children}
    </div>
  )
}
