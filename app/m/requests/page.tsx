'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Plus, X } from 'lucide-react'

import { toLogin, useHome } from '@/components/m/use-home'
import { errorText, isSessionError } from '@/lib/m/api'
import {
  LETTER_TYPES, REQUEST_KINDS, leaveDays, requestsSelf, statusInfo, validateRequest,
  type LeaveBalance, type RequestFormValues, type RequestKind, type StatusTone,
} from '@/lib/m/selfservice'
import type { FlowRow } from '@/lib/requests-api'

const TONE: Record<StatusTone, string> = {
  wait: 'bg-[#fdf6ea] text-[#7a4c0f]',
  ok: 'bg-[#eef8f3] text-[#1f6b4a]',
  no: 'bg-[#fdecea] text-[#a3341f]',
  idle: 'bg-[#eef3f3] text-[#5b7a7f]',
}

const kindLabel = (t: string) => REQUEST_KINDS.find((k) => k.key === t)?.label || t

export default function MobileRequestsPage() {
  const { data: home } = useHome()
  const [rows, setRows] = useState<FlowRow[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await requestsSelf.list())
      setError('')
    } catch (e) {
      if (isSessionError(e)) return toLogin()
      setError(errorText(e))
      setRows([])
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const cancel = async (flow: string) => {
    if (!window.confirm('إلغاء هذا الطلب؟')) return
    setBusy(flow)
    try {
      await requestsSelf.cancel(flow)
      await load()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <header className="bg-gradient-to-b from-[#1d4d56] to-[#163d44] px-5 pb-5 pt-[max(18px,env(safe-area-inset-top))] text-white">
        <h1 className="text-[20px] font-bold">طلباتي</h1>
        <button
          onClick={() => { setCreating(true); setDone(false) }}
          disabled={!home}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-bold text-[#1d4d56] disabled:opacity-60"
        >
          <Plus className="h-5 w-5" />
          طلب جديد
        </button>
      </header>

      <div className="space-y-3 px-4 py-4">
        {done && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-[#eef8f3] p-3 text-[14px] text-[#1f6b4a]">
            <CheckCircle2 className="h-5 w-5" /> تم إرسال الطلب
          </p>
        )}
        {error && <p role="alert" className="rounded-xl bg-[#fdf6ea] p-4 text-center text-[14px] text-[#7a4c0f]">{error}</p>}
        {rows === null && (
          <div className="flex justify-center py-12 text-[#2f7480]">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        )}
        {rows && rows.length === 0 && !error && <p className="py-14 text-center text-[14px] text-[#7b9396]">لا توجد طلبات بعد</p>}
        {rows?.map((r) => {
          const st = statusInfo(r.status)
          return (
            <article key={r.flow} className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,42,47,.5)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15.5px] font-bold">{(r as any).label_ar || kindLabel(r.request_type)}</p>
                <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${TONE[st.tone]}`}>{st.label}</span>
              </div>
              <p className="mt-1 text-[12px] tabular-nums text-[#7b9396]">{String((r as any).created || r.creation || '').slice(0, 10)}</p>
              {r.status === 'Pending' && (
                <button
                  onClick={() => cancel(r.flow)}
                  disabled={busy === r.flow}
                  className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-[#f3d2cc] text-[14px] font-bold text-[#c2410c] disabled:opacity-60"
                >
                  {busy === r.flow ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إلغاء الطلب'}
                </button>
              )}
            </article>
          )
        })}
      </div>

      {creating && home && (
        <NewRequest
          employee={home.employee.name}
          onClose={() => setCreating(false)}
          onSent={() => { setCreating(false); setDone(true); load() }}
        />
      )}
    </>
  )
}

const inputCls = 'h-12 w-full rounded-xl border border-[#dbe5e6] bg-white px-3 text-[15px] outline-none focus:border-[#2f7480]'

function NewRequest({ employee, onClose, onSent }: { employee: string; onClose: () => void; onSent: () => void }) {
  const [kind, setKind] = useState<RequestKind>('leave')
  const [v, setV] = useState<RequestFormValues>({ log_type: 'IN', letter_type: LETTER_TYPES[0].value })
  const [types, setTypes] = useState<string[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    requestsSelf.balances(employee).then(setBalances).catch(() => {})
    requestsSelf.leaveTypes().then(setTypes).catch(() => {})
  }, [employee])

  const set = (patch: RequestFormValues) => setV((p) => ({ ...p, ...patch }))
  const leaveOptions = Array.from(new Set([...balances.map((b) => b.leave_type), ...types]))
  const bal = balances.find((b) => b.leave_type === v.leave_type)
  const days = leaveDays(v.from_date, v.to_date)

  const submit = async () => {
    const msg = validateRequest(kind, v)
    if (msg) return setError(msg)
    setSending(true)
    setError('')
    try {
      await requestsSelf.create(kind, employee, v)
      onSent()
    } catch (e) {
      if (isSessionError(e)) return toLogin()
      setError(errorText(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="طلب جديد">
      <div className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-[#f3f6f6] p-5 pb-[max(20px,env(safe-area-inset-bottom))]" dir="rtl">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold">طلب جديد</h2>
          <button onClick={onClose} aria-label="إغلاق" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {REQUEST_KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => { setKind(k.key); setError('') }}
              aria-pressed={kind === k.key}
              className={`min-h-[48px] rounded-xl px-1 text-[13px] font-bold ${kind === k.key ? 'bg-[#1d4d56] text-white' : 'bg-white text-[#16343a]'}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {kind === 'leave' && (
            <>
              <Field label="نوع الإجازة">
                <select className={inputCls} value={v.leave_type || ''} onChange={(e) => set({ leave_type: e.target.value })}>
                  <option value="">اختر…</option>
                  {leaveOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {bal && <p className="mt-1 text-[12.5px] text-[#5b7a7f]">رصيدك: <span className="font-bold tabular-nums">{bal.balance}</span> يوم</p>}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="من"><input type="date" className={inputCls} value={v.from_date || ''} onChange={(e) => set({ from_date: e.target.value })} /></Field>
                <Field label="إلى"><input type="date" className={inputCls} value={v.to_date || ''} min={v.from_date} onChange={(e) => set({ to_date: e.target.value })} /></Field>
              </div>
              {days > 0 && <p className="text-[13px] font-bold text-[#2f7480]">المدة: {days} يوم</p>}
              <Field label="السبب (اختياري)"><textarea className={`${inputCls} h-24 py-2`} value={v.description || ''} onChange={(e) => set({ description: e.target.value })} /></Field>
            </>
          )}
          {kind === 'permission' && (
            <>
              <Field label="التاريخ"><input type="date" className={inputCls} value={v.permission_date || ''} onChange={(e) => set({ permission_date: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="من الساعة"><input type="time" className={inputCls} value={v.from_time || ''} onChange={(e) => set({ from_time: e.target.value })} /></Field>
                <Field label="إلى الساعة"><input type="time" className={inputCls} value={v.to_time || ''} onChange={(e) => set({ to_time: e.target.value })} /></Field>
              </div>
              <Field label="السبب (اختياري)"><textarea className={`${inputCls} h-24 py-2`} value={v.reason || ''} onChange={(e) => set({ reason: e.target.value })} /></Field>
            </>
          )}
          {kind === 'letter' && (
            <>
              <Field label="نوع الخطاب">
                <select className={inputCls} value={v.letter_type || ''} onChange={(e) => set({ letter_type: e.target.value })}>
                  {LETTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="الغرض (اختياري)"><textarea className={`${inputCls} h-24 py-2`} value={v.purpose || ''} onChange={(e) => set({ purpose: e.target.value })} /></Field>
            </>
          )}
          {kind === 'punch' && (
            <>
              <Field label="وقت البصمة"><input type="datetime-local" className={inputCls} value={v.requested_time || ''} onChange={(e) => set({ requested_time: e.target.value })} /></Field>
              <Field label="النوع">
                <select className={inputCls} value={v.log_type} onChange={(e) => set({ log_type: e.target.value as 'IN' | 'OUT' })}>
                  <option value="IN">حضور</option>
                  <option value="OUT">انصراف</option>
                </select>
              </Field>
              <Field label="السبب"><textarea className={`${inputCls} h-24 py-2`} value={v.reason || ''} onChange={(e) => set({ reason: e.target.value })} /></Field>
            </>
          )}
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-[#fdf6ea] p-3 text-center text-[14px] text-[#7a4c0f]">{error}</p>}
        <button
          onClick={submit}
          disabled={sending}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#24817f] text-[16px] font-bold text-white disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إرسال الطلب'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-[#5b7a7f]">{label}</span>
      {children}
    </label>
  )
}
