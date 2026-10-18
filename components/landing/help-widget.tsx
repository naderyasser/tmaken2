'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, MessageCircle, PhoneCall, Send, X } from 'lucide-react'

import { CONTACT } from '@/lib/site-contact'

/**
 * «تحتاج مساعدة؟» — bottom-right corner of the public pages: chat answered by
 * the AI assistant (`assistant` from the backend; the team can still reply from
 * the operator panel) or a call-back request.
 * Backend: site_creator.hr_store (request_call / chat_send / chat_poll).
 */
type View = 'menu' | 'chat' | 'call' | 'sent'
type Msg = { from: 'visitor' | 'team'; text: string; at: number }
type Options = Record<'languages' | 'channels' | 'reasons' | 'slots', Record<string, string>>

const CHAT_KEY = 'masar_chat'

let IN_APP = false // set by the embedded (HR system) widget: chats/calls get tagged with the client's site

async function call<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  if (IN_APP) args = { ...args, inApp: true }
  const r = await fetch(`/support-api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
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

const SEEN_KEY = 'masar_chat_seen'
const lastSeen = () => {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0 } catch { return 0 }
}

export const HELP_EVENT = 'masar-help'

/** Opens the help window from anywhere (the HR sidebar's «تحتاج مساعدة؟»). */
export function openHelp() {
  window.dispatchEvent(new Event(HELP_EVENT))
}

/**
 * `embedded`: inside a client's HR system — opened from the sidebar button
 * (the floating pill stays only on small screens, where the sidebar is hidden),
 * the window sits beside the sidebar, and messages carry the client's site.
 */
export function HelpWidget({ embedded = false }: { embedded?: boolean }) {
  IN_APP = embedded
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [unread, setUnread] = useState(0)
  const [online, setOnline] = useState<boolean | null>(null)
  const [assistant, setAssistant] = useState(false)
  const markRead = useCallback(() => setUnread(0), [])

  useEffect(() => {
    const show = () => { setOpen(true); setView((v) => (v === 'sent' ? 'menu' : v)) }
    window.addEventListener(HELP_EVENT, show)
    return () => window.removeEventListener(HELP_EVENT, show)
  }, [])

  // closed or on another view: check every 15 s for team replies → badge
  useEffect(() => {
    if (open && view === 'chat') return
    const check = async () => {
      const c = savedChat()
      try {
        if (c) {
          const r = await call<{ messages: Msg[]; team_online: boolean; assistant?: boolean }>('chat_poll', { chat: c.id, token: c.token })
          setOnline(r.team_online)
          setAssistant(!!r.assistant)
          setUnread(r.messages.filter((m) => m.from === 'team' && m.at > lastSeen()).length)
        } else {
          const r = await call<{ team_online: boolean; assistant?: boolean }>('team_status')
          setOnline(r.team_online)
          setAssistant(!!r.assistant)
        }
      } catch { /* offline: keep the last state */ }
    }
    check()
    const t = setInterval(check, embedded ? 30000 : 15000)
    return () => clearInterval(t)
  }, [open, view, embedded])

  // translate="no": Chrome's page translation swaps these text nodes for <font>s,
  // and React then crashed («client-side exception») the moment the window opened.
  return (
    <div dir="rtl" translate="no" className={`notranslate fixed bottom-4 z-50 flex flex-col items-end gap-3 ${embedded ? 'right-4 lg:right-[266px]' : 'right-4'}`} style={{ fontFamily: 'var(--font-kufi), var(--font-arabic), system-ui, sans-serif' }}>
      {open && (
        <div role="dialog" aria-label="تحتاج مساعدة؟"
          className="flex max-h-[min(620px,calc(100dvh-110px))] w-[min(370px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[#dbe5e6] bg-white shadow-[0_30px_80px_-30px_rgba(15,42,47,.55)]">
          <div className="flex items-center gap-2 bg-[#163d44] px-4 py-3 text-white">
            {view !== 'menu' && view !== 'sent' && (
              <button type="button" onClick={() => setView('menu')} aria-label="رجوع" className="rounded p-1 hover:bg-white/10"><ArrowRight className="h-4 w-4" /></button>
            )}
            <div className="flex-1">
              <b className="block text-[15px]">{view === 'chat' ? (assistant ? 'مساعد مسار الذكي' : 'محادثة مع فريقنا') : view === 'call' ? 'اطلب مكالمة' : 'تحتاج مساعدة؟'}</b>
              {view === 'chat' && online !== null && (
                <span className="flex items-center gap-1.5 text-[12px] text-white/70" data-testid="team-status">
                  <span className={`h-2 w-2 rounded-full ${online ? 'bg-[#6cc196]' : 'bg-white/40'}`} />
                  {assistant ? 'يرد فوراً على مدار الساعة' : online ? 'متصلون الآن' : 'غير متصلين حالياً'}
                </span>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          {view === 'menu' && (
            <div className="space-y-3 p-4">
              <p className="text-[14px] leading-7 text-[#2c4a50]">فريقنا جاهز يساعدك في اختيار الباقة وربط أجهزة البصمة وأي سؤال عن النظام.</p>
              <button type="button" onClick={() => setView('chat')} className="flex w-full items-center gap-3 rounded-xl bg-[#24817f] px-4 py-3 text-start text-white hover:bg-[#1d6b69]">
                <MessageCircle className="h-5 w-5 shrink-0" />
                <span className="flex-1">
                  <span className="block text-[15px] font-bold">{assistant ? 'اسأل مساعد مسار الذكي' : 'محادثة مباشرة مع فريقنا'}</span>
                  {online !== null && <span className="text-[12px] text-white/75">{assistant ? 'إجابات فورية عن الباقات والأجهزة والنظام' : online ? 'متصلون الآن — نرد خلال دقائق' : 'اترك رسالتك ونرد عليك'}</span>}
                </span>
                {online && <span className="h-2.5 w-2.5 rounded-full bg-[#6cc196] ring-2 ring-white/40" />}
                {unread > 0 && <span className="rounded-full bg-[#f0ae4f] px-2 text-[12px] font-bold text-[#3b2a09]">{unread}</span>}
              </button>
              <button type="button" onClick={() => setView('call')} className="flex w-full items-center gap-3 rounded-xl border border-[#24817f] px-4 py-3 text-start text-[#24817f] hover:bg-[#e6f4f2]">
                <PhoneCall className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-[15px] font-bold">اطلب مكالمة</span>
              </button>
              <div className="flex items-center justify-between gap-2 border-t border-[#eef3f3] pt-3 text-[13px] text-[#5b7a7f]">
                <a href={CONTACT.whatsappHref} target="_blank" rel="noopener" className="flex items-center gap-1.5 font-bold text-[#1f9d55] hover:underline">
                  <WhatsAppIcon /> واتساب
                </a>
                <a href={CONTACT.phoneHref} className="hover:text-[#24817f]" dir="ltr">{CONTACT.phoneDisplay}</a>
              </div>
            </div>
          )}
          {view === 'chat' && <Chat onOnline={setOnline} onAssistant={setAssistant} onRead={markRead} />}
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
      <button type="button" onClick={() => { setOpen((o) => !o); if (!open) setView(unread > 0 ? 'chat' : 'menu') }} aria-expanded={open}
        className={`relative ${embedded ? 'lg:hidden' : ''} flex h-12 items-center gap-2 rounded-full bg-[#163d44] px-5 text-[15px] font-bold text-white shadow-[0_14px_30px_-10px_rgba(15,42,47,.7)] hover:bg-[#1d4d56]`}>
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        تحتاج مساعدة؟
        {!open && unread > 0 && (
          <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f0ae4f] px-1 text-[11px] font-bold text-[#3b2a09]" data-testid="help-unread">{unread}</span>
        )}
      </button>
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 3.9 3.5 1.5.6 2 .7 2.7.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.4Z" />
    </svg>
  )
}

function Chat({ onOnline, onAssistant, onRead }: { onOnline: (v: boolean) => void; onAssistant: (v: boolean) => void; onRead: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [teamTyping, setTeamTyping] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const [seenAt, setSeenAt] = useState(0)
  const [assistant, setAssistant] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const chat = useRef(savedChat())
  const lastTyping = useRef(0)
  const sending = useRef(false)

  const apply = useCallback((r: { messages: Msg[]; team_online: boolean; team_typing: boolean; seen_at: number; assistant?: boolean }) => {
    setMsgs(r.messages)
    setAssistant(!!r.assistant)
    onAssistant(!!r.assistant)
    setTeamTyping(r.team_typing)
    setOnline(r.team_online)
    onOnline(r.team_online)
    setSeenAt(r.seen_at || 0)
    try { localStorage.setItem(SEEN_KEY, String(Date.now() / 1000)) } catch { /* ignore */ }
    onRead()
  }, [onOnline, onAssistant, onRead])

  const poll = useCallback(async () => {
    try {
      if (chat.current) apply(await call('chat_poll', { chat: chat.current.id, token: chat.current.token }))
      else {
        const r = await call<{ team_online: boolean; assistant?: boolean }>('team_status')
        setOnline(r.team_online)
        onOnline(r.team_online)
        setAssistant(!!r.assistant)
        onAssistant(!!r.assistant)
      }
    } catch { /* a lost conversation just starts over on the next message */ }
  }, [apply, onOnline, onAssistant])

  // live: every 2 s while the chat is on screen (and the tab is visible)
  useEffect(() => {
    poll()
    const t = setInterval(() => { if (document.visibilityState === 'visible' && !sending.current) poll() }, 2000)
    return () => clearInterval(t)
  }, [poll])
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs, teamTyping])

  const typing = (v: string) => {
    setText(v)
    const now = Date.now()
    if (chat.current && v && now - lastTyping.current > 3000) {
      lastTyping.current = now
      call('chat_typing', { chat: chat.current.id, token: chat.current.token }).catch(() => {})
    }
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    const sent = text
    sending.current = true
    setBusy(true)
    setError('')
    setText('')
    setMsgs((m) => [...m, { from: 'visitor', text: sent, at: Date.now() / 1000 }])
    if (assistant) setTeamTyping(true)
    try {
      const r = await call<{ id: string; token?: string; messages: Msg[]; team_online: boolean; team_typing: boolean; seen_at: number }>('chat_send', {
        chat: chat.current?.id, token: chat.current?.token, text: sent, name,
      })
      if (r.token) {
        chat.current = { id: r.id, token: r.token }
        try { localStorage.setItem(CHAT_KEY, JSON.stringify(chat.current)) } catch { /* ignore */ }
      }
      apply(r)
    } catch (err) {
      setMsgs((m) => m.slice(0, -1))
      setText(sent)
      setTeamTyping(false)
      setError(err instanceof Error ? err.message : 'تعذّر الإرسال')
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  const lastMine = [...msgs].reverse().find((m) => m.from === 'visitor')
  const waitingReply = msgs.length > 0 && msgs[msgs.length - 1].from === 'visitor'

  return (
    <div className="flex flex-col">
      <div className="h-[min(300px,42dvh)] space-y-2 overflow-y-auto bg-[#f4f8f8] p-3" aria-live="polite">
        <Bubble from="team" text={assistant
          ? (IN_APP
            ? 'أهلاً بك! أنا مساعد مسار الذكي — اسألني عن أي شيء في النظام: الدوامات، أجهزة البصمة، التقارير، الطلبات…'
            : 'أهلاً بك! أنا مساعد مسار الذكي — اسألني عن الباقات والأسعار وأجهزة البصمة وطريقة الاشتراك، وأرد عليك فوراً.')
          : online === false
          ? 'أهلاً بك! فريقنا غير متصل الآن — اترك رسالتك وسنرد عليك هنا فور عودتنا، أو راسلنا على واتساب.'
          : 'أهلاً بك! اكتب سؤالك وسيرد عليك أحد أعضاء فريقنا هنا مباشرة.'} />
        {msgs.map((m, i) => <Bubble key={i} from={m.from} text={m.text} />)}
        {!assistant && lastMine && waitingReply && (
          <p className="text-start text-[11.5px] text-[#7b9396]" data-testid="seen">{seenAt >= lastMine.at ? 'تمت القراءة ✓✓' : 'تم الإرسال ✓'}</p>
        )}
        {teamTyping && (
          <div className="flex justify-end" data-testid="team-typing">
            <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 shadow-sm">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7b9396]" style={{ animationDelay: `${i * 150}ms` }} />)}
            </span>
          </div>
        )}
        <div ref={end} />
      </div>
      {assistant && (
        <a href={CONTACT.whatsappHref} target="_blank" rel="noopener" data-testid="human-handoff"
          className="flex items-center justify-center gap-2 border-t border-[#eef3f3] py-2 text-[12.5px] text-[#5b7a7f] hover:text-[#1f9d55]">
          <WhatsAppIcon /> تفضّل التحدث مع موظف؟ راسلنا على واتساب
        </a>
      )}
      {!assistant && online === false && (
        <a href={CONTACT.whatsappHref} target="_blank" rel="noopener"
          className="flex items-center justify-center gap-2 border-t border-[#eef3f3] bg-[#effaf3] py-2 text-[13px] font-bold text-[#1f9d55]">
          <WhatsAppIcon /> راسلنا على واتساب الآن
        </a>
      )}
      <form onSubmit={send} className="space-y-2 border-t border-[#eef3f3] p-3">
        {!chat.current && (
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="اسمك (اختياري)"
            className="h-9 w-full rounded-lg border border-[#dbe5e6] px-3 text-[14px] outline-none focus:border-[#24817f]" />
        )}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => typing(e.target.value)} maxLength={1000} placeholder="اكتب رسالتك…" aria-label="رسالتك"
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
