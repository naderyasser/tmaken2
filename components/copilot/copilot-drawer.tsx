'use client'

/**
 * مساعد تمكين — Tamkeen Copilot chat drawer + floating launcher.
 *
 * Role-aware self-service assistant. On mount it asks the backend whether the
 * caller is HR / a line-manager (get_manager_copilot_status.available):
 *   • ADMIN mode  → answers workforce-wide questions (headcount, an employee's
 *     contract, workforce stats) via manager_chat, permission-scoped server-side.
 *   • EMPLOYEE mode → answers the caller's own HR data via copilot_chat, with
 *     "navigate" deep-links into the approval-routed flows.
 * Self-hides unless the tenant has Copilot enabled. RTL-aware, token-only, uses
 * the motion layer (hr-scale-in / hr-fade-up) so it feels fluid. Never writes HR data.
 */
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X, Send, Mic, BarChart3, FileSpreadsheet, Paperclip, Volume2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { copilotApi, type BriefingAlert, type CopilotChart, type CopilotChip, type CopilotSuggestion } from '@/lib/copilot-api'

interface Msg {
  role: 'user' | 'assistant'
  /** What is currently VISIBLE — grows char by char while typing. */
  text: string
  /** The full target text; `text` catches up to it via the typewriter tick. */
  full?: string
  /** Still revealing (or still receiving stream chunks). */
  typing?: boolean
  suggestions?: CopilotSuggestion[]
  alerts?: BriefingAlert[]
  chart?: CopilotChart
  route?: string
  traceId?: string
  feedback?: 'up' | 'down'
  ai?: boolean
  /** Action draft awaiting the user's explicit تأكيد/إلغاء. */
  action?: { token: string; label: string } | null
  /** Data answers with a metric can be exported to Excel by trace_id. */
  metric?: string
  /** Explicit «هات إكسل» request — a ready download link from the server. */
  exportUrl?: string
  /** Label for the download button (a letter PDF isn't an "Excel file"). */
  downloadLabel?: string
}

type Mode = 'employee' | 'manager'

// Manager chips arrive as plain strings; employee chips as {key,label_ar,label_en}.
function normalizeChips(chips: unknown): CopilotChip[] {
  if (!Array.isArray(chips)) return []
  return chips.map((c, i) =>
    typeof c === 'string'
      ? { key: `c${i}`, label_ar: c, label_en: c }
      : (c as CopilotChip),
  )
}

export function CopilotDrawer() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const router = useRouter()

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode>('employee')
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [chips, setChips] = useState<CopilotChip[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [briefed, setBriefed] = useState(false)
  const [listening, setListening] = useState(false)
  const [micSupported, setMicSupported] = useState(false)
  const [ttsSupported, setTtsSupported] = useState(false)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sessionId = useRef<string>('me-' + Math.random().toString(36).slice(2, 9))

  // Set in an effect, not during render: the server doesn't know whether this
  // browser has SpeechRecognition/speechSynthesis, and guessing causes a
  // hydration mismatch.
  useEffect(() => {
    const w = window as any
    setMicSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    setTtsSupported(typeof w.speechSynthesis !== 'undefined')
  }, [])

  // Closing the drawer must silence it — a voice with no visible source reads
  // as a bug, not a feature.
  useEffect(() => {
    if (!open && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setSpeakingIdx(null)
    }
  }, [open])

  /**
   * The typewriter tick — what makes the assistant feel ALIVE instead of
   * printing finished paragraphs. Any message whose `text` trails its `full`
   * target advances a few characters per frame; streamed chunks extend `full`
   * and the reveal simply keeps chasing it. Catch-up speed is proportional to
   * the backlog so a long cached answer doesn't crawl.
   */
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => {
      setMsgs((prev) => {
        let changed = false
        const next = prev.map((m) => {
          const full = m.full ?? m.text
          if (!m.typing || m.text.length >= full.length) return m
          changed = true
          const step = Math.max(2, Math.ceil((full.length - m.text.length) / 14))
          return { ...m, text: full.slice(0, m.text.length + step) }
        })
        return changed ? next : prev
      })
    }, 28)
    return () => clearInterval(id)
  }, [open])

  // Resolve role: prefer the admin brain when the caller is HR / a line-manager.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const m = await copilotApi.managerStatus()
        if (alive && m?.available && m?.enabled) {
          setMode('manager')
          setEnabled(true)
          setChips(normalizeChips(m.chips))
          return
        }
      } catch {
        /* fall through to employee mode */
      }
      try {
        const s = await copilotApi.status()
        if (alive) {
          setMode('employee')
          setEnabled(!!s?.enabled)
        }
      } catch {
        if (alive) {
          setMode('employee')
          setEnabled(false)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const greeting = () =>
    mode === 'manager'
      ? tx(
          "Hi! I'm the Admin Assistant. Ask about headcount, a specific employee's contract, or a workforce summary.",
          'أهلاً! أنا مساعد الأدمن. اسألني عن أعداد الموظفين، عقد موظف معيّن، أو ملخّص إحصائيات المنشأة.',
        )
      : tx(
          "Hi! I'm Tamkeen Copilot. Ask me about your leave, requests, payslip, documents, or letters.",
          'أهلاً! أنا مساعد تمكين. اسألني عن إجازاتك، طلباتك، راتبك، مستنداتك أو الخطابات.',
        )

  // On first open, lead with what needs attention rather than waiting to be asked.
  useEffect(() => {
    if (!open || msgs.length > 0) return
    setMsgs([{ role: 'assistant', text: '', full: greeting(), typing: true }])
    if (mode !== 'manager' || briefed) return
    setBriefed(true)
    ;(async () => {
      try {
        const b = await copilotApi.briefing()
        if (b?.available && b?.alerts?.length) {
          setMsgs((m) => [...m, { role: 'assistant', text: '', full: b.reply || '', typing: true, alerts: b.alerts }])
        }
      } catch {
        /* briefing is a bonus, never a blocker */
      }
    })()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  /** Patch the last assistant message in place (streaming writes into it). */
  const patchLast = (patch: Partial<Msg> | ((m: Msg) => Partial<Msg>)) => {
    setMsgs((prev) => {
      const i = prev.length - 1
      if (i < 0 || prev[i].role !== 'assistant') return prev
      const p = typeof patch === 'function' ? patch(prev[i]) : patch
      return prev.map((m, mi) => (mi === i ? { ...m, ...p } : m))
    })
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      let r
      if (mode === 'manager') {
        r = await copilotApi.managerStream(q, sessionId.current)
      } else {
        // employee v2 brain first (KB + self-diagnosis + human voice); any
        // failure means "that worker doesn't have it yet" → plain v1 chat
        try {
          r = await copilotApi.employeeChat(q, sessionId.current)
        } catch {
          r = await copilotApi.chat(q, sessionId.current)
        }
      }

      const base: Msg = {
        role: 'assistant',
        text: '',
        typing: true,
        suggestions: (r as any).suggestions,
        route: (r as any).route,
        chart: (r as any).chart,
        traceId: (r as any).trace_id,
        ai: r.ai_used,
        action: (r as any).action || null,
        metric: (r as any).metric,
        exportUrl: (r as any).export_url,
        downloadLabel: (r as any).download_label,
      }
      if ((r as any).chips?.length) setChips(normalizeChips((r as any).chips))

      if (mode === 'manager' && (r as any).streaming && (r as any).stream_id) {
        // The deterministic reply is already in hand — it is the safety net,
        // not the display. Poll the narrated stream into the bubble; if the
        // model is slow (>7s to first word) or a guard kills the stream, swap
        // in the correct deterministic text and stop waiting.
        setMsgs((m) => [...m, { ...base, full: '' }])
        const sid = (r as any).stream_id as string
        const fallback = r.reply || ''
        let cursor = 0
        let got = false
        let streamed = ''
        const deadline = Date.now() + 7000
        for (;;) {
          let p
          try {
            p = await copilotApi.managerPoll(sid, cursor)
          } catch {
            p = { delta: '', cursor, done: true, aborted: true }
          }
          if (p.delta) {
            got = true
            streamed += p.delta
            cursor = p.cursor
            patchLast({ full: streamed, ai: true })
          }
          if (p.done) {
            if (p.aborted || !streamed.trim()) patchLast({ full: fallback, ai: r.ai_used })
            break
          }
          if (!got && Date.now() > deadline) {
            patchLast({ full: fallback, ai: r.ai_used })
            break
          }
          await new Promise((res) => setTimeout(res, 350))
        }
        patchLast((m) => ({ typing: (m.full ?? '').length > m.text.length }))
      } else {
        setMsgs((m) => [...m, { ...base, full: r.reply }])
      }
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: tx('Something went wrong — please try again.', 'حدث خطأ — حاول مرة أخرى.') },
      ])
    } finally {
      setBusy(false)
    }
  }

  /** Confirm or cancel a drafted action. The token is one-time server-side, so
   *  double-taps are harmless — but we also strip the buttons immediately. */
  const runAction = async (msgIndex: number, token: string, verdict: 'confirm' | 'cancel') => {
    setMsgs((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, action: null } : m)))
    setBusy(true)
    try {
      const r =
        verdict === 'confirm'
          ? await copilotApi.actionConfirm(token)
          : await copilotApi.actionCancel(token)
      // a confirmed letter comes back with its PDF — carry the download through
      setMsgs((m) => [...m, {
        role: 'assistant', text: '', full: r.reply, typing: true,
        exportUrl: (r as any).export_url, downloadLabel: (r as any).download_label,
      }])
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: '', full: tx('Action failed — nothing changed.', 'فشل التنفيذ — لم يتغيّر شيء.'), typing: true },
      ])
    } finally {
      setBusy(false)
    }
  }

  /** Arabic voice input — he opens the system from his phone; talking beats
   *  typing Arabic on a phone keyboard. Final transcript auto-sends. */
  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    recRef.current = rec
    rec.lang = isRTL ? 'ar-SA' : 'en-US'
    rec.interimResults = true
    let finalText = ''
    rec.onresult = (e: any) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput(t)
      if (e.results[e.results.length - 1].isFinal) finalText = t
    }
    rec.onend = () => {
      setListening(false)
      recRef.current = null
      if (finalText.trim()) {
        setInput('')
        send(finalText)
      }
    }
    rec.onerror = () => {
      setListening(false)
      recRef.current = null
    }
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }

  /** Read an answer aloud (ar-SA). Tapping the same button again stops it;
   *  starting another message stops the previous one — one voice at a time. */
  const toggleSpeak = (i: number, text: string) => {
    const synth = window.speechSynthesis
    if (!synth) return
    if (speakingIdx === i) {
      synth.cancel()
      setSpeakingIdx(null)
      return
    }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[•]/g, '،'))
    u.lang = isRTL ? 'ar-SA' : 'en-US'
    // prefer an Arabic voice when the platform ships one; the default voice
    // otherwise still reads Arabic on iOS/Android, just less naturally
    const voice = synth.getVoices().find((v) => v.lang?.startsWith(isRTL ? 'ar' : 'en'))
    if (voice) u.voice = voice
    u.onend = () => setSpeakingIdx((cur) => (cur === i ? null : cur))
    u.onerror = () => setSpeakingIdx((cur) => (cur === i ? null : cur))
    setSpeakingIdx(i)
    synth.speak(u)
  }

  /** Attachment: whatever is typed in the input becomes the question about the
   *  file — «مين أكثر واحد تأخير؟» + the attendance sheet in one gesture. */
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''            // allow re-picking the same file later
    if (!f || busy) return
    const q = input.trim()
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: `📎 ${f.name}${q ? ` — ${q}` : ''}` }])
    setBusy(true)
    try {
      const r = await copilotApi.attachmentAnalyze(f, q || undefined, sessionId.current)
      setMsgs((m) => [...m, { role: 'assistant', text: '', full: r.reply, typing: true, ai: true }])
    } catch {
      setMsgs((m) => [...m, {
        role: 'assistant', text: '', typing: true,
        full: tx('Could not analyze the file — supported: Excel, CSV, PDF, images up to 8MB.',
                 'تعذّر تحليل الملف — المدعوم: Excel وCSV وPDF وصور حتى ٨ ميجا.'),
      }])
    } finally {
      setBusy(false)
    }
  }

  const goto = (s: CopilotSuggestion) => {
    setOpen(false)
    router.push(s.href)
  }

  if (!enabled) return null

  const title = mode === 'manager' ? tx('Admin Assistant', 'مساعد الأدمن') : tx('Tamkeen Copilot', 'مساعد تمكين')
  const subtitle =
    mode === 'manager' ? tx('Facility-wide HR view', 'رؤية على بيانات المنشأة') : tx('Your HR assistant', 'مساعدك للموارد البشرية')
  const launcherLabel = mode === 'manager' ? tx('Admin', 'مساعد الأدمن') : tx('Copilot', 'مساعد تمكين')

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={tx('Open assistant', 'فتح المساعد')}
          className={cn(
            // The owner has weak eyesight: big, red, high-contrast, and pinned
            // top-RIGHT (physical right, requested explicitly — not start/end)
            // just below the h-16 sticky header so it never covers its buttons.
            'hr-lift fixed z-40 flex items-center gap-2 rounded-full bg-red-600 text-white',
            'shadow-xl ring-4 ring-red-200 hover:bg-red-700',
            'h-16 w-16 justify-center sm:h-auto sm:w-auto sm:px-5 sm:py-4',
            'top-[4.5rem] right-3 sm:right-5',
          )}
        >
          <Sparkles className="h-8 w-8 sm:h-7 sm:w-7" />
          <span className="text-base font-bold hidden sm:inline">{launcherLabel}</span>
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div
          className={cn(
            // Phone: a true full-screen sheet — a 400px card on a phone leaves the
            // input under the keyboard and the text unreadably small.
            'fixed inset-0 z-50',
            'sm:inset-auto sm:bottom-5 sm:w-[min(400px,calc(100vw-2rem))]',
            isRTL ? 'sm:start-5' : 'sm:end-5',
          )}
        >
          <div
            className={cn(
              'hr-scale-in flex flex-col overflow-hidden border-border bg-card shadow-2xl',
              'h-[100dvh] rounded-none border-0',
              'sm:h-[70vh] sm:max-h-[560px] sm:rounded-2xl sm:border',
            )}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><Sparkles className="h-4 w-4" /></span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-[11px] opacity-80">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {mode === 'manager' && (
                  <button
                    onClick={() => { setOpen(false); router.push('/copilot-insights') }}
                    aria-label={tx('Assistant insights', 'إحصائيات المساعد')}
                    title={tx('Assistant insights', 'إحصائيات المساعد')}
                    className="rounded-lg p-2.5 hover:bg-white/15 sm:p-1.5"
                  >
                    <BarChart3 className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label={tx('Close', 'إغلاق')}
                  className="rounded-lg p-2.5 hover:bg-white/15 sm:p-1.5"
                >
                  <X className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {msgs.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'hr-fade-up max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 leading-relaxed',
                    'text-[15px] sm:text-[13px]',
                    m.role === 'user' ? 'bg-primary text-primary-foreground rounded-ee-sm' : 'bg-secondary text-foreground rounded-es-sm',
                  )}>
                    {m.text}
                    {/* Live cursor while the reply is being written — the single
                        strongest "someone is typing to you" signal there is. */}
                    {m.role === 'assistant' && m.typing && (
                      <span className="ms-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-current opacity-70" />
                    )}
                    {m.chart && m.chart.bars?.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {m.chart.bars.map((b, k) => (
                          <div key={`b${k}`} className="text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{b.label}</span>
                              <span className="font-semibold tabular-nums" dir="ltr">{b.value}</span>
                            </div>
                            {/* Plain CSS bars: a chart library would ship ~50KB and still
                                need RTL wrangling inside a 400px drawer. */}
                            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(3, (b.value / (m.chart!.max || 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Action draft: nothing executes until this explicit tap.
                        Hidden while typing so he confirms what he has READ. */}
                    {m.role === 'assistant' && m.action && !m.typing && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => runAction(i, m.action!.token, 'confirm')}
                          className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
                        >
                          ✓ {tx('Confirm', 'تأكيد')}
                        </button>
                        <button
                          onClick={() => runAction(i, m.action!.token, 'cancel')}
                          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
                        >
                          ✕ {tx('Cancel', 'إلغاء')}
                        </button>
                      </div>
                    )}
                    {/* «هات إكسل» — the server already picked the last exportable
                        turn and returned its ready link. */}
                    {m.role === 'assistant' && m.exportUrl && !m.typing && (
                      <a
                        href={m.exportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        {m.downloadLabel || tx('Download Excel file', 'تنزيل ملف الإكسل')}
                      </a>
                    )}
                    {/* Excel export — the file re-runs the audited query under
                        the caller's CURRENT permissions, never the chat text. */}
                    {m.role === 'assistant' && m.metric && m.traceId && !m.typing && (
                      <a
                        href={copilotApi.exportUrl(m.traceId)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        {tx('Download as Excel', 'تنزيل إكسل')}
                      </a>
                    )}
                    {m.role === 'assistant' && !m.typing && (m.traceId || ttsSupported) && (
                      <div className="mt-2 flex items-center gap-1.5 opacity-70">
                        {ttsSupported && (m.full || m.text) && (
                          <button
                            onClick={() => toggleSpeak(i, m.full || m.text)}
                            aria-label={speakingIdx === i ? tx('Stop reading', 'إيقاف القراءة') : tx('Read aloud', 'اقرأ بصوت')}
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-xs hover:bg-primary/10',
                              speakingIdx === i && 'bg-primary/15 text-primary',
                            )}
                          >
                            {speakingIdx === i
                              ? <Square className="h-3.5 w-3.5" />
                              : <Volume2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        {m.traceId && (['up', 'down'] as const).map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              copilotApi.feedback(m.traceId!, v).catch(() => {})
                              setMsgs((prev) => prev.map((x, xi) => (xi === i ? { ...x, feedback: v } : x)))
                            }}
                            aria-label={v === 'up' ? tx('Helpful', 'مفيد') : tx('Not helpful', 'غير مفيد')}
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-xs hover:bg-primary/10',
                              m.feedback === v && 'bg-primary/15',
                            )}
                          >
                            {v === 'up' ? '👍' : '👎'}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.alerts?.map((a, k) => (
                      a.route ? (
                        <button
                          key={`a${k}`}
                          onClick={() => { setOpen(false); router.push(a.route!) }}
                          className="mt-2 block w-full rounded-lg border border-primary/30 bg-card px-3 py-2 text-start text-xs font-semibold text-primary hover:bg-accent"
                        >
                          {tx('Open', 'افتح')} {a.title_ar} →
                        </button>
                      ) : null
                    ))}
                    {m.route && !m.suggestions?.length && (
                      <button
                        onClick={() => { setOpen(false); router.push(m.route!) }}
                        className="mt-2 block w-full rounded-lg border border-primary/30 bg-card px-3 py-2 text-start text-xs font-semibold text-primary hover:bg-accent"
                      >
                        {tx('Open the screen', 'افتح الشاشة')} →
                      </button>
                    )}
                    {m.suggestions?.map((s, j) => (
                      <button key={j} onClick={() => goto(s)}
                        className="mt-2 block w-full rounded-lg border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent">
                        {isRTL ? s.label_ar : s.label_en} →
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {/* Typing dots — only while we have NOTHING to show yet; once the
                  streamed bubble exists, its own cursor takes over. A spinner
                  says "processing"; dots say "he's writing to you". */}
              {busy && msgs[msgs.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl bg-secondary px-3.5 py-3">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Suggestion chips */}
            {chips.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto border-t border-border px-3 py-2 sm:flex-wrap sm:overflow-visible">
                {chips.map((c) => (
                  <button key={c.key} onClick={() => send(isRTL ? c.label_ar : c.label_en)}
                    className="shrink-0 whitespace-nowrap rounded-full border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-foreground hover:border-primary/40 hover:text-primary sm:px-2.5 sm:py-1 sm:text-[11px]">
                    {isRTL ? c.label_ar : c.label_en}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input) }}
              className="flex items-center gap-2 border-t border-border p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:pb-2.5"
            >
              {/* text-base (16px) on mobile: anything smaller makes iOS Safari
                  zoom the whole page the moment the field is focused. */}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? tx('Listening…', 'أسمعك…') : tx('Ask anything…', 'اسأل عن أي شيء…')}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-2 sm:text-sm"
              />
              {mode === 'manager' && (
                <>
                  {/* Attach: Excel/CSV/PDF/image → analyzed server-side; the
                      typed text (if any) rides along as the question. */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xlsm,.xls,.csv,.pdf,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={onFile}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    aria-label={tx('Attach a file', 'إرفاق ملف')}
                    title={tx('Attach: Excel / CSV / PDF / image', 'إرفاق: إكسل / CSV / PDF / صورة')}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-muted-foreground hover:text-primary disabled:opacity-40 sm:h-9 sm:w-9"
                  >
                    <Paperclip className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                </>
              )}
              {micSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={busy}
                  aria-label={tx('Voice input', 'إدخال صوتي')}
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:h-9 sm:w-9',
                    listening
                      ? 'animate-pulse border-red-500 bg-red-500 text-white'
                      : 'border-input bg-background text-muted-foreground hover:text-primary',
                  )}
                >
                  <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              )}
              <button type="submit" disabled={busy || !input.trim()} aria-label={tx('Send', 'إرسال')}
                className="hr-lift flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 sm:h-9 sm:w-9">
                <Send className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
