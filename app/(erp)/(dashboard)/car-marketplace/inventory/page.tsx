'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { carMarketplaceApi, type InventoryRow, type InventoryKind } from '@/lib/car-marketplace-api'
import { formatNumber, formatPrice } from '@/lib/aqar-format'
import { cn } from '@/lib/utils'
import { Search, Star, ExternalLink, Car, Cog, Sparkles, Recycle, Wrench, Store, ChevronRight, ChevronLeft } from 'lucide-react'

const PAGE = 20
const STORE = 'https://cars.meena-alaqariya.com'

const KINDS: { kind: InventoryKind; labelAr: string; labelEn: string; icon: typeof Car; storePath: string }[] = [
  { kind: 'vehicle', labelAr: 'السيارات', labelEn: 'Vehicles', icon: Car, storePath: '/cars' },
  { kind: 'spare_part', labelAr: 'قطع الغيار', labelEn: 'Spare Parts', icon: Cog, storePath: '/spare-parts' },
  { kind: 'accessory', labelAr: 'الزينة', labelEn: 'Accessories', icon: Sparkles, storePath: '/accessories' },
  { kind: 'scrap', labelAr: 'التشليح', labelEn: 'Scrap', icon: Recycle, storePath: '/scrap' },
  { kind: 'service_center', labelAr: 'مراكز الصيانة', labelEn: 'Service Centers', icon: Wrench, storePath: '/service-centers' },
  { kind: 'parts_shop', labelAr: 'محلات قطع الغيار', labelEn: 'Parts Shops', icon: Store, storePath: '/spare-parts/shops' },
]

const STATUS_AR: Record<string, string> = {
  Draft: 'مسودة', Published: 'منشور', Sold: 'مباع', Inactive: 'موقوف',
}
const STATUS_TONE: Record<string, string> = {
  Published: 'bg-emerald-100 text-emerald-800', Draft: 'bg-gray-100 text-gray-600',
  Sold: 'bg-blue-100 text-blue-800', Inactive: 'bg-orange-100 text-orange-800',
}

function isKind(v: string | null): v is InventoryKind {
  return !!v && KINDS.some((k) => k.kind === v)
}

export default function InventoryControlPage() {
  const { isRTL, lang } = useI18n()
  const { user } = useAuth()
  const sp = useSearchParams()
  const canWrite = user?.roles?.some((r) => ['Marketplace Manager', 'System Manager', 'Administrator'].includes(r)) ?? false

  const [kind, setKind] = useState<InventoryKind>(isKind(sp.get('kind')) ? (sp.get('kind') as InventoryKind) : 'vehicle')
  const [status, setStatus] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await carMarketplaceApi.listInventory({
        kind,
        status: status || undefined,
        search: search || undefined,
        limit_start: page * PAGE,
        limit_page_length: PAGE,
      })
      setRows(res.data)
      setTotal(res.total_count)
      setStatuses(res.statuses || [])
    } finally {
      setLoading(false)
    }
  }, [kind, status, search, page])

  useEffect(() => { load() }, [load])

  const meta = KINDS.find((k) => k.kind === kind)!

  const setRowStatus = async (name: string, s: string) => {
    const prev = rows
    setRows(rows.map((r) => (r.name === name ? { ...r, status: s } : r)))
    try {
      await carMarketplaceApi.setInventoryStatus(kind, name, s)
    } catch {
      setRows(prev)
    }
  }

  const toggleStar = async (row: InventoryRow) => {
    const next = row.is_featured ? 0 : 1
    const prev = rows
    setRows(rows.map((r) => (r.name === row.name ? { ...r, is_featured: next as 0 | 1 } : r)))
    try {
      await carMarketplaceApi.toggleFeatured(kind, row.name, next as 0 | 1)
    } catch {
      setRows(prev)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">
          {isRTL ? 'إدارة المعروضات' : 'Inventory Control'}
          <span className="ms-2 text-sm font-normal text-gray-400">({formatNumber(total, lang)})</span>
        </h1>
        <div className="relative">
          <Search className={cn('absolute top-2.5 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder={isRTL ? 'بحث بالعنوان' : 'Search title'}
            className={cn('h-10 w-64 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#B25E54]', isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3')}
          />
        </div>
      </div>

      {/* Kind tabs */}
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const Icon = k.icon
          return (
            <button
              key={k.kind}
              onClick={() => { setKind(k.kind); setStatus(''); setPage(0) }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors',
                kind === k.kind ? 'bg-[#8E4338] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {isRTL ? k.labelAr : k.labelEn}
            </button>
          )
        })}
        <span className="mx-1 h-8 w-px bg-gray-200" />
        {['', ...statuses].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(0) }}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs transition-colors',
              status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200',
            )}
          >
            {s === '' ? (isRTL ? 'كل الحالات' : 'All') : isRTL ? STATUS_AR[s] || s : s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-gray-100 bg-white">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-50" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">{isRTL ? 'لا توجد عناصر' : 'No items'}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {rows.map((r) => (
              <li key={r.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {r.cover_image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r.cover_image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{r.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {r.brand ? <span>{r.brand} {r.model || ''}</span> : null}
                      {r.year ? <span>{r.year}</span> : null}
                      {r.city ? <span>{r.city}</span> : null}
                      {r.category ? <span>{r.category}</span> : null}
                      {r.part_number ? <span dir="ltr">{r.part_number}</span> : null}
                      {r.listing_type ? <span>{r.listing_type === 'Scrap Car' ? (isRTL ? 'سيارة تشليح' : 'Scrap car') : (isRTL ? 'قطعة مستعملة' : 'Used part')}</span> : null}
                      {typeof r.price_sar === 'number' && r.price_sar > 0 ? (
                        <span className="font-bold text-gray-700">{formatPrice(r.price_sar, lang)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.slug && r.status === 'Published' ? (
                    <a
                      href={`${STORE}${meta.storePath}/${encodeURIComponent(r.slug)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                      aria-label={isRTL ? 'عرض في المتجر' : 'View in store'}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                  {canWrite ? (
                    <>
                      <button
                        onClick={() => toggleStar(r)}
                        className={cn(
                          'grid h-8 w-8 place-items-center rounded-lg border transition-colors',
                          r.is_featured ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-gray-200 text-gray-300 hover:text-gray-500',
                        )}
                        aria-label={isRTL ? 'تمييز' : 'Feature'}
                      >
                        <Star className="h-4 w-4" fill={r.is_featured ? 'currentColor' : 'none'} />
                      </button>
                      <select
                        value={r.status}
                        onChange={(e) => setRowStatus(r.name, e.target.value)}
                        className={cn('h-8 rounded-full border-0 px-3 text-xs font-medium outline-none', STATUS_TONE[r.status] || 'bg-gray-100')}
                      >
                        {statuses.map((s) => <option key={s} value={s}>{isRTL ? STATUS_AR[s] || s : s}</option>)}
                      </select>
                    </>
                  ) : (
                    <span className={cn('rounded-full px-3 py-1 text-xs font-medium', STATUS_TONE[r.status] || 'bg-gray-100')}>
                      {isRTL ? STATUS_AR[r.status] || r.status : r.status}
                    </span>
                  )}
                </div>
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
