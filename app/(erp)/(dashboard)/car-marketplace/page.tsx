'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { carMarketplaceApi, type CarDashboard } from '@/lib/car-marketplace-api'
import { formatNumber, formatPrice, timeAgo } from '@/lib/aqar-format'
import {
  Car, Cog, Sparkles, Recycle, Wrench, Store, Inbox, HandCoins, ArrowUpRight, AlertCircle,
} from 'lucide-react'

const KIND_META = [
  { kind: 'vehicle', labelAr: 'السيارات', labelEn: 'Vehicles', icon: Car, tone: 'text-red-700 bg-red-50' },
  { kind: 'spare_part', labelAr: 'قطع الغيار', labelEn: 'Spare Parts', icon: Cog, tone: 'text-amber-700 bg-amber-50' },
  { kind: 'accessory', labelAr: 'زينة السيارات', labelEn: 'Accessories', icon: Sparkles, tone: 'text-violet-700 bg-violet-50' },
  { kind: 'scrap', labelAr: 'التشليح', labelEn: 'Scrap', icon: Recycle, tone: 'text-gray-700 bg-gray-100' },
  { kind: 'service_center', labelAr: 'مراكز الصيانة', labelEn: 'Service Centers', icon: Wrench, tone: 'text-blue-700 bg-blue-50' },
  { kind: 'parts_shop', labelAr: 'محلات قطع الغيار', labelEn: 'Parts Shops', icon: Store, tone: 'text-emerald-700 bg-emerald-50' },
] as const

const LEAD_TONE: Record<string, string> = {
  New: 'bg-sky-100 text-sky-800',
  Contacted: 'bg-amber-100 text-amber-800',
  Closed: 'bg-gray-100 text-gray-600',
  Purchased: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
}
const LEAD_AR: Record<string, string> = { New: 'جديد', Contacted: 'تم التواصل', Closed: 'مغلق', Purchased: 'تم الشراء', Rejected: 'مرفوض' }
const INTEREST_AR: Record<string, string> = {
  Vehicle: 'سيارة', 'Spare Part': 'قطعة غيار', Accessory: 'زينة', Scrap: 'تشليح',
  Service: 'صيانة', Finance: 'تمويل', General: 'عام',
}

export default function CarMarketplaceDashboard() {
  const { isRTL, lang } = useI18n()
  const [data, setData] = useState<CarDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    carMarketplaceApi.getDashboard().then(setData).catch((e) => setError(e?.message || 'تعذر التحميل'))
  }, [])

  if (error) {
    return (
      <div className="mt-10 flex items-center gap-3 rounded-2xl border-2 border-red-100 bg-red-50/50 p-6 text-red-700">
        <AlertCircle className="h-5 w-5 shrink-0" /> {error}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    )
  }

  const newLeads = data.leads.New || 0
  const newSells = data.sell_requests.New || 0

  return (
    <div className="space-y-8">
      {/* Requests strip */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/car-marketplace/leads?status=New" className="group flex items-center justify-between rounded-2xl border-2 border-sky-100 bg-white p-5 transition-all hover:border-sky-300 hover:shadow-md">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-sky-50 text-sky-700"><Inbox className="h-6 w-6" /></span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(newLeads, lang)}</p>
              <p className="text-sm text-gray-500">{isRTL ? 'طلبات عملاء جديدة' : 'New customer leads'}</p>
            </div>
          </div>
          <ArrowUpRight className="h-5 w-5 text-sky-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
        <Link href="/car-marketplace/sell-requests?status=New" className="group flex items-center justify-between rounded-2xl border-2 border-emerald-100 bg-white p-5 transition-all hover:border-emerald-300 hover:shadow-md">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><HandCoins className="h-6 w-6" /></span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(newSells, lang)}</p>
              <p className="text-sm text-gray-500">{isRTL ? 'طلبات بيع سيارات جديدة' : 'New sell requests'}</p>
            </div>
          </div>
          <ArrowUpRight className="h-5 w-5 text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>

      {/* Inventory KPIs */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-500">{isRTL ? 'المعروضات' : 'Inventory'}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {KIND_META.map((k) => {
            const inv = data.inventory[k.kind]
            const Icon = k.icon
            const published = inv?.by_status?.Published || 0
            return (
              <Link
                key={k.kind}
                href={`/car-marketplace/inventory?kind=${k.kind}`}
                className="group rounded-2xl border-2 border-gray-100 bg-white p-4 transition-all hover:border-gray-200 hover:shadow-md"
              >
                <span className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${k.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-xl font-bold text-gray-900">{formatNumber(inv?.total || 0, lang)}</p>
                <p className="text-xs text-gray-500">{isRTL ? k.labelAr : k.labelEn}</p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  {formatNumber(published, lang)} {isRTL ? 'منشور' : 'published'}
                </p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent leads + sell requests */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border-2 border-gray-100 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-bold text-gray-900">{isRTL ? 'أحدث طلبات العملاء' : 'Latest leads'}</h2>
            <Link href="/car-marketplace/leads" className="text-xs font-medium text-[#8E4338] hover:underline">
              {isRTL ? 'عرض الكل' : 'View all'}
            </Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.recent_leads.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-gray-400">{isRTL ? 'لا توجد طلبات بعد' : 'No leads yet'}</li>
            )}
            {data.recent_leads.map((l) => (
              <li key={l.name} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{l.full_name}</p>
                  <p className="text-xs text-gray-500" dir="ltr">{l.phone}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                    {isRTL ? INTEREST_AR[l.interest_type] || l.interest_type : l.interest_type}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${LEAD_TONE[l.lead_status] || ''}`}>
                    {isRTL ? LEAD_AR[l.lead_status] || l.lead_status : l.lead_status}
                  </span>
                  <span className="text-[11px] text-gray-400">{timeAgo(l.creation, lang)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border-2 border-gray-100 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-bold text-gray-900">{isRTL ? 'أحدث طلبات البيع' : 'Latest sell requests'}</h2>
            <Link href="/car-marketplace/sell-requests" className="text-xs font-medium text-[#8E4338] hover:underline">
              {isRTL ? 'عرض الكل' : 'View all'}
            </Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {data.recent_sell_requests.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-gray-400">{isRTL ? 'لا توجد طلبات بعد' : 'No requests yet'}</li>
            )}
            {data.recent_sell_requests.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {s.brand || s.model_text || '—'} {s.model || ''} {s.year || ''}
                  </p>
                  <p className="text-xs text-gray-500">{s.full_name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.asking_price_sar ? (
                    <span className="text-xs font-bold text-gray-700">{formatPrice(s.asking_price_sar, lang)}</span>
                  ) : null}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${LEAD_TONE[s.request_status] || ''}`}>
                    {isRTL ? LEAD_AR[s.request_status] || s.request_status : s.request_status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
