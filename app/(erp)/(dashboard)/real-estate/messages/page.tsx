'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { realEstateApi, type AqarThread, type AqarMessage } from '@/lib/real-estate-api'
import { timeAgo } from '@/lib/aqar-format'
import { MessageCircle, Send, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

export default function MessagesPage() {
  const { t, lang, isRTL } = useI18n()
  const L = lang as 'ar' | 'en'
  const Back = isRTL ? ChevronRight : ChevronLeft
  const [threads, setThreads] = useState<AqarThread[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [messages, setMessages] = useState<AqarMessage[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const loadThreads = async () => {
    setLoading(true)
    try {
      const ts = await realEstateApi.getMyThreads()
      setThreads(ts)
      const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('thread') : null
      if (q) setActive(q)
      else if (!active && ts.length) setActive(ts[0].name)
    } finally { setLoading(false) }
  }
  useEffect(() => { loadThreads() /* eslint-disable-next-line */ }, [])

  const loadMessages = async (thread: string) => {
    setMessages(await realEstateApi.getMessages(thread).catch(() => []))
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }
  useEffect(() => { if (active) loadMessages(active) /* eslint-disable-next-line */ }, [active])

  const send = async () => {
    if (!active || !body.trim()) return
    setBusy(true)
    try { await realEstateApi.sendMessage(active, body); setBody(''); await loadMessages(active); await loadThreads() }
    finally { setBusy(false) }
  }

  const current = threads.find((x) => x.name === active)

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('re.messages')}</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Threads */}
        <div className={`rounded-2xl border-2 border-gray-100 bg-white ${active ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="space-y-2 p-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : threads.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400"><MessageCircle className="mx-auto mb-2 h-7 w-7 text-gray-300" />{t('re.noThreads')}</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {threads.map((th) => (
                <li key={th.name}>
                  <button onClick={() => setActive(th.name)} className={`w-full p-3 text-start hover:bg-gray-50 ${active === th.name ? 'bg-emerald-50/50' : ''}`}>
                    <p className="truncate text-sm font-semibold text-gray-800">{th.other_party}</p>
                    <p className="truncate text-xs text-gray-400">{th.listing_title || th.listing}</p>
                    {th.last_message && <p className="truncate text-xs text-gray-500">{th.last_message}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Conversation */}
        <div className={`flex min-h-[60vh] flex-col rounded-2xl border-2 border-gray-100 bg-white lg:col-span-2 ${active ? '' : 'hidden lg:flex'}`}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">{t('re.noThreads')}</div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                <button onClick={() => setActive(null)} className="lg:hidden"><Back className="h-5 w-5 text-gray-500" /></button>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{current?.other_party}</p>
                  <p className="text-xs text-gray-400">{current?.listing_title || current?.listing}</p>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => (
                  <div key={m.name} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender === current?.buyer ? 'bg-gray-100 text-gray-800' : 'ms-auto bg-emerald-700 text-white'}`}>
                    {m.body}
                    <span className={`mt-1 block text-[10px] ${m.sender === current?.buyer ? 'text-gray-400' : 'text-emerald-100'}`}>{timeAgo(m.creation, L)}</span>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="flex gap-2 border-t border-gray-100 p-3">
                <input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={t('re.typeMessage')} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                <button onClick={send} disabled={busy || !body.trim()} className="flex items-center gap-1 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
