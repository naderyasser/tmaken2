'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { carMarketplaceApi, type SellRequest, type SellStatus } from '@/lib/car-marketplace-api'
import { formatNumber, formatPrice, dualDate } from '@/lib/aqar-format'
import { cn } from '@/lib/utils'
import { Search, Phone, ChevronDown, ChevronRight, ChevronLeft, ImageOff } from 'lucide-react'

const PAGE = 20
const STATUSES: SellStatus[] = ['New', 'Contacted', 'Purchased', 'Rejected']
const STATUS_AR: Record<string, string> = { New: 'جديد', Contacted: 'تم التواصل', Purchased: 'تم الشراء', Rejected: 'مرفوض' }
const STATUS_TONE: Record<string, string> = {
  New: 'bg-sky-100 text-sky-800', Contacted: 'bg-amber-100 text-amber-800',
  Purchased: 'bg-emerald-100 text-emerald-800', Rejected: 'bg-red-100 text-red-800',
}

export default function SellRequestsPage() {
  const { isRTL, lang } = useI18n()
  const { user } = useAuth()
  const sp = useSearchParams()
  const canWrite = user?.roles?.some((r) => ['Marketplace Manager', 'System Manager', 'Administrator'].includes(r)) ?? false

  const [status, setStatus] = useState<string>(sp.get('status') || '')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<SellRequest[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openName, setOpenName] = useState<string | null>(null)
  const [detail, setDetail] = useState<SellRequest | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await carMarketplaceApi.listSellRequests({
        status: status || undefined,
        search: search || undefined,
        limit_start: page * PAGE,
        limit_page_length: PAGE,
      })
      setRows(res.data)
      setTotal(res.total_count)
    } finally {
      setLoading(false)
    }
  }, [status, search, page])

  useEffect(() => { load() }, [load])

  const toggleDetail = async (name: string) => {
    if (openName === name) { setOpenName(null); setDetail(null); return }
    setOpenName(name)
    setDetail(null)
    try { setDetail(await carMarketplaceApi.getSellRequest(name)) } catch { setOpenName(null) }
  }

  const setReqStatus = async (name: string, s: SellStatus) => {
    const prev = rows
    setRows(rows.map((r) => (r.name === name ? { ...r, request_status: s } : r)))
    try {
      await carMarketplaceApi.updateSellRequestStatus(name, s)
    } catch {
      setRows(prev)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">
          {isRTL ? 'طلبات بيع السيارات' : 'Sell Requests'}
          <span className="ms-2 text-sm font-normal text-gray-400">({formatNumber(total, lang)})</span>
        </h1>
        <div className="relative">
          <Search className={cn('absolute top-2.5 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder={isRTL ? 'بحث بالاسم أو الجوال أو السيارة' : 'Search name, phone or car'}
            className={cn('h-10 w-72 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#B25E54]', isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3')}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-gray-100 bg-white">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-50" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">{isRTL ? 'لا توجد طلبات مطابقة' : 'No matching requests'}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {rows.map((r) => (
              <li key={r.name} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button onClick={() => toggleDetail(r.name)} className="flex min-w-0 items-center gap-2 text-start">
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', openName === r.name && 'rotate-180')} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {r.brand || r.model_text || '—'} {r.model || ''} {r.year || ''}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                        <span>{r.full_name}</span>
                        <span dir="ltr" className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {r.phone}</span>
                        {r.mileage_km ? <span>{formatNumber(r.mileage_km, lang)} {isRTL ? 'كم' : 'km'}</span> : null}
                        <span className="text-gray-400">{dualDate(r.creation, lang)}</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700">
                      {r.asking_price_sar ? formatPrice(r.asking_price_sar, lang) : (isRTL ? 'بدون سعر' : 'No price')}
                    </span>
                    {canWrite ? (
                      <select
                        value={r.request_status}
                        onChange={(e) => setReqStatus(r.name, e.target.value as SellStatus)}
                        className={cn('h-8 rounded-full border-0 px-3 text-xs font-medium outline-none', STATUS_TONE[r.request_status])}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{isRTL ? STATUS_AR[s] : s}</option>)}
                      </select>
                    ) : (
                      <span className={cn('rounded-full px-3 py-1 text-xs font-medium', STATUS_TONE[r.request_status])}>
                        {isRTL ? STATUS_AR[r.request_status] : r.request_status}
                      </span>
                    )}
                  </div>
                </div>

                {openName === r.name && (
                  <div className="mt-3 rounded-xl bg-gray-50 p-4">
                    {!detail ? (
                      <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                    ) : (
                      <div className="space-y-3">
                        {detail.notes ? <p className="text-sm text-gray-600">{detail.notes}</p> : null}
                        {detail.photos && detail.photos.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {detail.photos.map((p, i) => (
                              <a key={i} href={p.image} target="_blank" rel="noopener noreferrer" className="block h-20 w-28 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.image} alt="" className="h-full w-full object-cover" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                            <ImageOff className="h-3.5 w-3.5" /> {isRTL ? 'لا توجد صور مرفقة' : 'No photos attached'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

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
