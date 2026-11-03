'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { frappeClient } from '@/lib/api-client'
import { realEstateApi, type AqarReport, type AqarComment } from '@/lib/real-estate-api'
import { timeAgo } from '@/lib/aqar-format'
import { Flag, MessageSquare, Check, X, Eye, EyeOff, Loader2 } from 'lucide-react'

const REASON_LABEL: Record<string, string> = {
  Fraud: 're.reasonFraud', 'Wrong Info': 're.reasonWrongInfo', Duplicate: 're.reasonDuplicate',
  Inappropriate: 're.reasonInappropriate', 'Already Sold or Rented': 're.reasonSold',
  Spam: 're.reasonSpam', Other: 're.reasonOther',
}
const STATUS_TONE: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800', 'Under Review': 'bg-blue-100 text-blue-800',
  Resolved: 'bg-emerald-100 text-emerald-800', Dismissed: 'bg-gray-100 text-gray-600',
}

type Tab = 'reports' | 'comments'

export default function ModerationPage() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const L = lang as 'ar' | 'en'
  const [tab, setTab] = useState<Tab>('reports')
  const [reports, setReports] = useState<AqarReport[]>([])
  const [comments, setComments] = useState<(AqarComment & { listing?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'reports') setReports(await realEstateApi.listReports())
      else setComments(await frappeClient.getList('Aqar Comment', {
        fields: ['name', 'listing', 'author_name', 'body', 'is_hidden', 'creation'],
        order_by: 'creation desc', limit_page_length: 100,
      }))
    } catch { /* surfaced as empty */ } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [tab])

  const resolveReport = async (name: string, status: string) => {
    setBusy(name)
    try { await realEstateApi.resolveReport(name, status); await load() } finally { setBusy(null) }
  }
  const toggleHide = async (name: string, hidden: number) => {
    setBusy(name)
    try { await realEstateApi.hideComment(name, hidden ? 0 : 1); await load() } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('re.moderation')}</h1>

      <div className="flex gap-2">
        <TabBtn active={tab === 'reports'} onClick={() => setTab('reports')} icon={Flag} label={t('re.moderationReports')} />
        <TabBtn active={tab === 'comments'} onClick={() => setTab('comments')} icon={MessageSquare} label={t('re.moderationComments')} />
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}</div>
      ) : tab === 'reports' ? (
        reports.length === 0 ? <Empty t={t} /> : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.name} className="rounded-2xl border-2 border-gray-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button onClick={() => router.push(`/real-estate/listings/${r.listing}`)} className="font-semibold text-emerald-700 hover:underline">{r.listing}</button>
                    <p className="mt-1 text-sm text-gray-700">{t(REASON_LABEL[r.reason] || 're.reasonOther')}{r.details ? ` — ${r.details}` : ''}</p>
                    <p className="mt-1 text-xs text-gray-400">{r.reported_by} · {timeAgo(r.creation, L)}{r.handled_by ? ` · ${t('re.handledBy')} ${r.handled_by}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[r.status]}`}>{r.status}</span>
                </div>
                {(r.status === 'Open' || r.status === 'Under Review') && (
                  <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                    <ActBtn onClick={() => resolveReport(r.name, 'Resolved')} busy={busy === r.name} icon={Check} label={t('re.resolve')} tone="emerald" />
                    <ActBtn onClick={() => resolveReport(r.name, 'Dismissed')} busy={busy === r.name} icon={X} label={t('re.dismiss')} tone="gray" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        comments.length === 0 ? <Empty t={t} /> : (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.name} className={`rounded-2xl border-2 p-4 ${c.is_hidden ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-800">{c.body}</p>
                    <p className="mt-1 text-xs text-gray-400">{c.author_name} · <button onClick={() => router.push(`/real-estate/listings/${c.listing}`)} className="text-emerald-700 hover:underline">{c.listing}</button> · {timeAgo(c.creation, L)}</p>
                  </div>
                  <ActBtn onClick={() => toggleHide(c.name, c.is_hidden || 0)} busy={busy === c.name} icon={c.is_hidden ? Eye : EyeOff} label={c.is_hidden ? t('re.unhide') : t('re.hide')} tone="gray" />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${active ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  )
}
function ActBtn({ onClick, busy, icon: Icon, label, tone }: any) {
  const tones: Record<string, string> = { emerald: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50', gray: 'text-gray-600 border-gray-200 hover:bg-gray-50' }
  return (
    <button onClick={onClick} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 ${tones[tone]}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}
    </button>
  )
}
function Empty({ t }: any) {
  return <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">{t('re.noListings')}</div>
}
