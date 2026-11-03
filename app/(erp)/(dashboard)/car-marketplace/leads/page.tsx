'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { carMarketplaceApi, type CarLead, type LeadStatus } from '@/lib/car-marketplace-api'
import { formatNumber, dualDate } from '@/lib/aqar-format'
import { cn } from '@/lib/utils'
import { Search, Phone, MessageSquareText, ChevronRight, ChevronLeft } from 'lucide-react'

const PAGE = 20
const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Closed']
const STATUS_AR: Record<string, string> = { New: 'جديد', Contacted: 'تم التواصل', Closed: 'مغلق' }
const STATUS_TONE: Record<string, string> = {
  New: 'bg-sky-100 text-sky-800', Contacted: 'bg-amber-100 text-amber-800', Closed: 'bg-gray-100 text-gray-600',
}
const INTERESTS = ['Vehicle', 'Spare Part', 'Accessory', 'Scrap', 'Service', 'Finance', 'General']
const INTEREST_AR: Record<string, string> = {
  Vehicle: 'سيارة', 'Spare Part': 'قطعة غيار', Accessory: 'زينة', Scrap: 'تشليح',
  Service: 'صيانة', Finance: 'تمويل', General: 'عام',
}

export default function CarLeadsPage() {
  const { isRTL, lang } = useI18n()
  const { user } = useAuth()
  const sp = useSearchParams()
  const canWrite = user?.roles?.some((r) => ['Marketplace Manager', 'System Manager', 'Administrator'].includes(r)) ?? false

  const [status, setStatus] = useState<string>(sp.get('status') || '')
  const [interest, setInterest] = useState<string>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<CarLead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await carMarketplaceApi.listLeads({
        status: status || undefined,
        interest: interest || undefined,
        search: search || undefined,
        limit_start: page * PAGE,
        limit_page_length: PAGE,
      })
      setRows(res.data)
      setTotal(res.total_count)
    } finally {
      setLoading(false)
    }
  }, [status, interest, search, page])

  useEffect(() => { load() }, [load])

  const setLeadStatus = async (name: string, s: LeadStatus) => {
    const prev = rows
    setRows(rows.map((r) => (r.name === name ? { ...r, lead_status: s } : r)))
    try {
      await carMarketplaceApi.updateLeadStatus(name, s)
    } catch {
      setRows(prev)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">
          {isRTL ? 'طلبات العملاء' : 'Customer Leads'}
          <span className="ms-2 text-sm font-normal text-gray-400">({formatNumber(total, lang)})</span>
        </h1>
        <div className="relative">
          <Search className={cn('absolute top-2.5 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder={isRTL ? 'بحث بالاسم أو الجوال' : 'Search name or phone'}
            className={cn('h-10 w-64 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#B25E54]', isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3')}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {['', ...STATUSES].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(0) }}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              status === s ? 'bg-[#8E4338] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
            )}
          >
            {s === '' ? (isRTL ? 'الكل' : 'All') : isRTL ? STATUS_AR[s] : s}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <select
          value={interest}
          onChange={(e) => { setInterest(e.target.value); setPage(0) }}
          className="h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-gray-600 outline-none"
        >
          <option value="">{isRTL ? 'كل الاهتمامات' : 'All interests'}</option>
          {INTERESTS.map((i) => (
            <option key={i} value={i}>{isRTL ? INTEREST_AR[i] : i}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border-2 border-gray-100 bg-white">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-50" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">{isRTL ? 'لا توجد طلبات مطابقة' : 'No matching leads'}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {rows.map((l) => (
              <li key={l.name} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{l.full_name}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-gray-800" dir="ltr">
                        <Phone className="h-3 w-3" /> {l.phone}
                      </a>
                      <span className="rounded-full bg-gray-50 px-2 py-0.5">{isRTL ? INTEREST_AR[l.interest_type] || l.interest_type : l.interest_type}</span>
                      {l.reference_name ? <span className="text-gray-400">{l.reference_name}</span> : null}
                      <span className="text-gray-400">{dualDate(l.creation, lang)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.message ? (
                      <button
                        onClick={() => setOpen(open === l.name ? null : l.name)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                        aria-label={isRTL ? 'عرض الرسالة' : 'View message'}
                      >
                        <MessageSquareText className="h-4 w-4" />
                      </button>
                    ) : null}
                    {canWrite ? (
                      <select
                        value={l.lead_status}
                        onChange={(e) => setLeadStatus(l.name, e.target.value as LeadStatus)}
                        className={cn('h-8 rounded-full border-0 px-3 text-xs font-medium outline-none', STATUS_TONE[l.lead_status])}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{isRTL ? STATUS_AR[s] : s}</option>)}
                      </select>
                    ) : (
                      <span className={cn('rounded-full px-3 py-1 text-xs font-medium', STATUS_TONE[l.lead_status])}>
                        {isRTL ? STATUS_AR[l.lead_status] : l.lead_status}
                      </span>
                    )}
                  </div>
                </div>
                {open === l.name && l.message ? (
                  <p className="mt-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">{l.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pager */}
      {total > PAGE && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
            aria-label={isRTL ? 'السابق' : 'Previous'}
          >
            {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <span className="text-sm text-gray-500">{formatNumber(page + 1, lang)} / {formatNumber(Math.ceil(total / PAGE), lang)}</span>
          <button
            disabled={(page + 1) * PAGE >= total}
            onClick={() => setPage(page + 1)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
            aria-label={isRTL ? 'التالي' : 'Next'}
          >
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
