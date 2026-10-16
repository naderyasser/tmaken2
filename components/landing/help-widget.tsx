'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, MessageCircle, PhoneCall, Send, X } from 'lucide-react'

/**
 * «تحتاج مساعدة؟» — bottom-right corner of the public pages: live chat with the
 * team (answered from the operator panel) or a call-back request.
 * Backend: site_creator.hr_store (request_call / chat_send / chat_poll).
 */
type View = 'menu' | 'chat' | 'call' | 'sent'
type Msg = { from: 'visitor' | 'team'; text: string; at: number }
type Options = Record<'languages' | 'channels' | 'reasons' | 'slots', Record<string, string>>

const CHAT_KEY = 'masar_chat'

async function call<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`/subscribe/api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'حصل خطأ، حاول مرة أخرى')
  return j.data as T
}

function savedChat(): { id: string; token: string } | null {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY) || 'null')
  } catch {
    return null
  }
}

export function HelpWidget() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [unread, setUnread] = useState(0)

  return (
    <div dir="rtl" className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3" style={{ fontFamily: 'var(--font-kufi), var(--font-arabic), system-ui, sans-serif' }}>
      {open && (
        <div role="dialog" aria-label="تحتاج مساعدة؟"
          className="flex max-h-[min(620px,calc(100dvh-110px))] w-[min(370px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[#dbe5e6] bg-white shadow-[0_30px_80px_-30px_rgba(15,42,47,.55)]">
          <div className="flex items-center gap-2 bg-[#163d44] px-4 py-3 text-white">
            {view !== 'menu' && view !== 'sent' && (
              <button type="button" onClick={() => setView('menu')} aria-label="رجوع" className="rounded p-1 hover:bg-white/10"><ArrowRight className="h-4 w-4" /></button>
            )}
            <b className="flex-1 text-[15px]">{view === 'chat' ? 'محادثة مع فريقنا' : view === 'call' ? 'اطلب مكالمة' : 'تحتاج مساعدة؟'}</b>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          {view === 'menu' && (
            <div className="space-y-3 p-4">
              <p className="text-[14px] leading-7 text-[#2c4a50]">فريقنا جاهز يساعدك في اختيار الباقة وربط أجهزة البصمة وأي سؤال عن النظام.</p>
              <button type="button" onClick={() => setView('chat')} className="flex w-full items-center gap-3 rounded-xl bg-[#24817f] px-4 py-3 text-start text-white hover:bg-[#1d6b69]">
                <MessageCircle className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-[15px] font-bold">محادثة مباشرة مع فريقنا</span>
                {unread > 0 && <span className="rounded-full bg-[#f0ae4f] px-2 text-[12px] font-bold text-[#3b2a09]">{unread}</span>}
              </button>
              <button type="button" onClick={() => setView('call')} className="flex w-full items-center gap-3 rounded-xl border border-[#24817f] px-4 py-3 text-start text-[#24817f] hover:bg-[#e6f4f2]">
                <PhoneCall className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-[15px] font-bold">اطلب مكالمة</span>
              </button>
            </div>
          )}
          {view === 'chat' && <Chat onUnread={setUnread} />}
          {view === 'call' && <CallForm onSent={() => setView('sent')} />}
          {view === 'sent' && (
            <div className="p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#2f9e6f]" />
              <p className="mt-3 text-[16px] font-bold text-[#163d44]">وصلنا طلبك</p>
              <p className="mt-1 text-[14px] text-[#5b7a7f]">سنتصل بك في الموعد الذي اخترته.</p>
              <button type="button" onClick={() => setView('menu')} className="mt-5 text-[14px] font-bold text-[#24817f]">تم</button>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={() => { setOpen((o) => !o); if (!open) setView('menu') }} aria-expanded={open}
        className="flex h-12 items-center gap-2 rounded-full bg-[#163d44] px-5 text-[15px] font-bold text-white shadow-[0_14px_30px_-10px_rgba(15,42,47,.7)] hover:bg-[#1d4d56]">
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        تحتاج مساعدة؟
        {!open && unread > 0 && <span className="h-2.5 w-2.5 rounded-full bg-[#f0ae4f]" />}
      </button>
    </div>
  )
}

function Chat({ onUnread }: { onUnread: (n: number) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const chat = useRef(savedChat())

  const poll = useCallback(async () => {
    if (!chat.current) return
    try {
      const r = await call<{ messages: Msg[] }>('chat_poll', { chat: chat.current.id, token: chat.current.token })
      setMsgs(r.messages)
    } catch {
      /* a lost conversation just starts over */
    }
  }, [])

  useEffect(() => {
    onUnread(0)
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [poll, onUnread])
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      const r = await call<{ id: string; token?: string; messages: Msg[] }>('chat_send', {
        chat: chat.current?.id, token: chat.current?.token, text, name,
      })
      if (r.token) {
        chat.current = { id: r.id, token: r.token }
        try { localStorage.setItem(CHAT_KEY, JSON.stringify(chat.current)) } catch { /* ignore */ }
      }
      setMsgs(r.messages)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الإرسال')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="h-[min(300px,42dvh)] space-y-2 overflow-y-auto bg-[#f4f8f8] p-3">
        <Bubble from="team" text="أهلاً بك! اكتب سؤالك وسيرد عليك أحد أعضاء فريقنا هنا." />
        {msgs.map((m, i) => <Bubble key={i} from={m.from} text={m.text} />)}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="space-y-2 border-t border-[#eef3f3] p-3">
        {!chat.current && (
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="اسمك (اختياري)"
            className="h-9 w-full rounded-lg border border-[#dbe5e6] px-3 text-[14px] outline-none focus:border-[#24817f]" />
        )}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="اكتب رسالتك…" aria-label="رسالتك"
            className="h-10 min-w-0 flex-1 rounded-lg border border-[#dbe5e6] px-3 text-[14px] outline-none focus:border-[#24817f]" />
          <button disabled={busy || !text.trim()} aria-label="إرسال" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#24817f] text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
          </button>
        </div>
        {error && <p className="text-[12.5px] text-[#a1350f]">{error}</p>}
      </form>
    </div>
  )
}

function Bubble({ from, text }: { from: 'visitor' | 'team'; text: string }) {
  const me = from === 'visitor'
  return (
    <div className={`flex ${me ? 'justify-start' : 'justify-end'}`}>
      <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[14px] leading-6 ${me ? 'rounded-br-sm bg-[#24817f] text-white' : 'rounded-bl-sm bg-white text-[#163d44] shadow-sm'}`}>{text}</p>
    </div>
  )
}

function nextDays() {
  const fmt = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' })
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { iso, label: i === 0 ? 'اليوم' : i === 1 ? 'غداً' : fmt.format(d) }
  })
}

function CallForm({ onSent }: { onSent: () => void }) {
  const [opts, setOpts] = useState<Options | null>(null)
  const [f, setF] = useState({ phone: '', language: 'ar', channel: '', reason: '', details: '', day: '', slot: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const days = nextDays()

  useEffect(() => {
    call<Options>('support_options').then(setOpts).catch(() => setError('تعذّر تحميل النموذج'))
  }, [])

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await call('request_call', f)
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الإرسال')
      setBusy(false)
    }
  }

  const field = 'h-10 w-full rounded-lg border border-[#dbe5e6] bg-white px-3 text-[14px] outline-none focus:border-[#24817f]'
  const label = 'mb-1 block text-[13px] font-bold text-[#2c4a50]'
  const chips = (k: 'channel' | 'slot', options: Record<string, string>) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([v, t]) => (
        <button type="button" key={v} onClick={() => setF({ ...f, [k]: v })}
          className={`rounded-lg px-3 py-2 text-[13px] font-bold ${f[k] === v ? 'bg-[#163d44] text-white' : 'bg-[#eef3f3] text-[#2c4a50]'}`}>{t}</button>
      ))}
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3 overflow-y-auto p-4">
      <div>
        <label className={label} htmlFor="cb-phone">رقم جوالك</label>
        <input id="cb-phone" required type="tel" value={f.phone} onChange={set('phone')} placeholder="05xxxxxxxx" dir="ltr" className={field} autoComplete="tel" />
      </div>
      <div>
        <label className={label} htmlFor="cb-lang">اللغة المفضلة</label>
        <select id="cb-lang" value={f.language} onChange={set('language')} className={field}>
          {opts && Object.entries(opts.languages).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div>
        <span className={label}>استفسارك عن</span>
        {opts && chips('channel', opts.channels)}
      </div>
      <div>
        <label className={label} htmlFor="cb-reason">وش سبب المكالمة؟</label>
        <select id="cb-reason" required value={f.reason} onChange={set('reason')} className={field}>
          <option value="" disabled>اختر السبب</option>
          {opts && Object.entries(opts.reasons).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <textarea value={f.details} onChange={set('details')} maxLength={500} rows={2} placeholder="تفاصيل إضافية (اختياري)"
          className="mt-2 w-full rounded-lg border border-[#dbe5e6] px-3 py-2 text-[14px] outline-none focus:border-[#24817f]" />
      </div>
      <div>
        <label className={label} htmlFor="cb-day">أي يوم نتصل فيك؟</label>
        <select id="cb-day" required value={f.day} onChange={set('day')} className={field}>
          <option value="" disabled>اختر اليوم</option>
          {days.map((d) => <option key={d.iso} value={d.iso}>{d.label}</option>)}
        </select>
      </div>
      <div>
        <span className={label}>في أي وقت؟</span>
        {opts && chips('slot', opts.slots)}
      </div>
      {error && <p className="text-[13px] text-[#a1350f]">{error}</p>}
      <button disabled={busy || !opts || !f.channel || !f.slot} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#24817f] text-[15px] font-bold text-white hover:bg-[#1d6b69] disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        إرسال الطلب
      </button>
    </form>
  )
}
