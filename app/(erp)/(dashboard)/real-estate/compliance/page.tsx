'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import {
  realEstateApi, type AqarComplaint, type AqarAuditEntry, type ExpiryMonitor,
} from '@/lib/real-estate-api'
import { dualDate, timeAgo } from '@/lib/aqar-format'
import { AlertTriangle, MessageSquareWarning, History, Download, Loader2, Plus } from 'lucide-react'

type Tab = 'expiry' | 'complaints' | 'audit'
const C_STATUS = ['New', 'In Progress', 'Resolved', 'Dismissed']
const C_STATUS_TONE: Record<string, string> = {
  New: 'bg-amber-100 text-amber-800', 'In Progress': 'bg-blue-100 text-blue-800',
  Resolved: 'bg-emerald-100 text-emerald-800', Dismissed: 'bg-gray-100 text-gray-600',
}

export default function CompliancePage() {
  const { t, lang, isRTL } = useI18n()
  const router = useRouter()
  const L = lang as 'ar' | 'en'
  const [tab, setTab] = useState<Tab>('expiry')
  const [expiry, setExpiry] = useState<ExpiryMonitor | null>(null)
  const [complaints, setComplaints] = useState<AqarComplaint[]>([])
  const [audit, setAudit] = useState<AqarAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [cForm, setCForm] = useState({ subject: '', details: '' })

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'expiry') setExpiry(await realEstateApi.getExpiryMonitor())
      else if (tab === 'complaints') setComplaints(await realEstateApi.listComplaints())
      else setAudit(await realEstateApi.getAudit())
    } catch { /* empty */ } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [tab])

  const setComplaintStatus = async (name: string, status: string) => {
    setBusy(name); try { await realEstateApi.updateComplaint(name, status); await load() } finally { setBusy(null) }
  }
  const createComplaint = async () => {
    if (!cForm.subject.trim()) return
    setBusy('new'); try { await realEstateApi.createComplaint(cForm.subject, cForm.details); setCForm({ subject: '', details: '' }); setShowForm(false); await load() } finally { setBusy(null) }
  }
  const exportData = async () => {
    setBusy('export')
    try {
      const data = await realEstateApi.exportUserData(undefined, undefined)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `rega-export.json`; a.click(); URL.revokeObjectURL(url)
    } finally { setBusy(null) }
  }

  const Bucket = ({ title, items, tone }: { title: string; items: any[]; tone: string }) => (
    <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
      <p className={`mb-2 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${tone}`}>{title} · {items.length}</p>
      {items.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
        <ul className="space-y-2">
          {items.map((l) => (
            <li key={l.name}>
              <button onClick={() => router.push(`/real-estate/listings/${l.name}`)} className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-2 text-start text-sm hover:bg-emerald-50">
                <span className="truncate font-medium text-gray-800">{l.title}</span>
                <span className="shrink-0 text-xs text-gray-500">{l.rega_license_expiry ? dualDate(l.rega_license_expiry, L) : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('re.compliance')}</h1>
        <button onClick={exportData} disabled={busy === 'export'} className="flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
          {busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('re.exportData')}
        </button>
      </div>

      <div className="flex gap-2">
        <Tb active={tab === 'expiry'} onClick={() => setTab('expiry')} icon={AlertTriangle} label={t('re.expiryMonitor')} />
        <Tb active={tab === 'complaints'} onClick={() => setTab('complaints')} icon={MessageSquareWarning} label={t('re.complaints')} />
        <Tb active={tab === 'audit'} onClick={() => setTab('audit')} icon={History} label={t('re.auditViewer')} />
      </div>

      {loading ? <div className="h-40 animate-pulse rounded-2xl bg-gray-100" /> : tab === 'expiry' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Bucket title={t('re.expired7')} items={expiry?.expired || []} tone="bg-red-100 text-red-700" />
          <Bucket title={t('re.kpiExpiring7')} items={expiry?.expiring_7 || []} tone="bg-orange-100 text-orange-700" />
          <Bucket title={t('re.kpiExpiring30')} items={expiry?.expiring_30 || []} tone="bg-amber-100 text-amber-700" />
        </div>
      ) : tab === 'complaints' ? (
        <div className="space-y-3">
          <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />{t('re.newComplaint')}</button>
          {showForm && (
            <div className="rounded-2xl border-2 border-emerald-100 bg-white p-4">
              <input value={cForm.subject} onChange={(e) => setCForm({ ...cForm, subject: e.target.value })} placeholder={t('re.subject')} className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <textarea value={cForm.details} onChange={(e) => setCForm({ ...cForm, details: e.target.value })} placeholder={t('re.description')} className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={2} />
              <button onClick={createComplaint} disabled={busy === 'new'} className="rounded-xl bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{t('re.save')}</button>
            </div>
          )}
          {complaints.length === 0 ? <Empty t={t} /> : complaints.map((c) => (
            <div key={c.name} className="rounded-2xl border-2 border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{c.subject}</p>
                  <p className="text-xs text-gray-500">{c.details}</p>
                  <p className="mt-1 text-xs text-gray-400">{t('re.ticket')} {c.name} · {t('re.slaDue')} {c.sla_due ? dualDate(c.sla_due, L) : '—'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${C_STATUS_TONE[c.status]}`}>{c.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {C_STATUS.filter((s) => s !== c.status).map((s) => (
                  <button key={s} onClick={() => setComplaintStatus(c.name, s)} disabled={busy === c.name} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-5">
          <ol className="relative space-y-3 border-s-2 border-gray-100 ps-4">
            {audit.length === 0 && <li className="text-xs text-gray-400">—</li>}
            {audit.map((a) => (
              <li key={a.name} className="relative">
                <span className="absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <p className="text-sm font-medium text-gray-800">{a.action} · <button onClick={() => router.push(`/real-estate/listings/${(a as any).listing}`)} className="text-emerald-700 hover:underline">{(a as any).listing}</button></p>
                <p className="text-xs text-gray-400">{a.user} · {timeAgo(a.creation, L)}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function Tb({ active, onClick, icon: Icon, label }: any) {
  return <button onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${active ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}><Icon className="h-4 w-4" />{label}</button>
}
function Empty({ t }: any) { return <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">{t('re.noListings')}</div> }
