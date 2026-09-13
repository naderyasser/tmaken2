import Link from 'next/link'
import { MapPin, Star, Maximize, TrendingUp, ArrowUpRight, Repeat } from 'lucide-react'
import { formatPrice, formatNumber } from '@/lib/aqar-format'
import ListingImage from '@/components/store/listing-image'
import type { ListingSearchResult } from '@/lib/real-estate-api'
import { type ListingMetrics, YIELD_BAND, isLand, vsMarketPct } from '@/lib/investment'

const pct = (v: number | null) => (v == null ? null : `${v.toFixed(1)}%`)
const signedPct = (v: number | null) => (v == null ? null : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`)

/** Listing card with an investment-metrics strip. All derived figures are clearly ESTIMATES.
 *  Lands are framed by resale/appreciation (price/m² vs the area average), not rental yield. */
export default function InvestmentCard({ l, m, marketAvg }: { l: ListingSearchResult; m: ListingMetrics; marketAvg?: number | null }) {
  const city = l.city_name_ar || l.city
  const district = l.district_name_ar || l.district
  const land = isLand(l)
  const inBand = m.grossYield != null && m.grossYield >= YIELD_BAND.min && m.grossYield <= YIELD_BAND.max
  const vsMarket = vsMarketPct(m.pricePerSqm, marketAvg ?? null)

  return (
    <Link href={`/listing/${l.name}`} className="aqar-card flex flex-col">
      <div className="relative h-40 w-full bg-[var(--aqar-sand-2)]">
        <ListingImage src={l.primary_image} alt={l.title} />
        {l.is_featured ? (
          <span className="aqar-badge-featured absolute top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ insetInlineStart: '0.5rem' }}>
            <Star className="h-3 w-3" />مميّز
          </span>
        ) : null}
        {l.category_name_ar ? (
          <span className="absolute top-2 rounded-full bg-[var(--aqar-espresso-fill)]/85 px-2 py-0.5 text-[11px] font-medium text-white" style={{ insetInlineEnd: '0.5rem' }}>
            {l.category_name_ar}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-1 font-bold text-[var(--aqar-kohl)]">{l.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--aqar-kohl)]/60">
          <MapPin className="h-3.5 w-3.5" />{[district, city].filter(Boolean).join('، ')}
        </p>
        <p className="aqar-price mt-2 text-lg">{formatPrice(l.price, 'ar', l.listing_type)}</p>

        {/* metrics strip — lands: price/m² + vs-market + resale framing; else: price/m² + yields */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--aqar-sand)] p-2 text-center">
          <Metric label="السعر/م²" value={m.pricePerSqm != null ? formatNumber(Math.round(m.pricePerSqm), 'ar') : null} unit="ريال" />
          {land ? (
            <>
              <Metric label="مقابل السوق" value={signedPct(vsMarket)} unit="متوسّط الحي" est />
              <Metric label="نوع العائد" value="إعادة البيع" unit="نموّ المنطقة" />
            </>
          ) : (
            <>
              <Metric label="العائد الإجمالي" value={pct(m.grossYield)} unit="سنوياً" est />
              <Metric label="العائد الصافي" value={pct(m.netYield)} unit="تقديري" est />
            </>
          )}
        </div>

        {!land && m.grossYield != null && m.rentN ? (
          <p className="mt-1.5 text-[9px] text-[var(--aqar-kohl)]/45">تقديري بناءً على {formatNumber(m.rentN, 'ar')} عقارات مماثلة</p>
        ) : null}

        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--aqar-kohl)]/50">
          <span className="inline-flex items-center gap-1">
            {l.area_sqm != null && <><Maximize className="h-3 w-3" />{formatNumber(l.area_sqm, 'ar')} م²</>}
          </span>
          {land ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--aqar-sand-2)] px-1.5 py-0.5 text-[var(--aqar-kohl)]/55">
              <Repeat className="h-3 w-3" />عائد عبر إعادة البيع
            </span>
          ) : inBand ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--aqar-green)]/10 px-1.5 py-0.5 text-[var(--aqar-green-d)]">
              <TrendingUp className="h-3 w-3" />ضمن النطاق المعتاد
            </span>
          ) : m.grossYield == null ? (
            <span className="text-[var(--aqar-kohl)]/35">العائد غير متوفر</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function Metric({ label, value, unit, est }: { label: string; value: string | null; unit?: string; est?: boolean }) {
  // Never render 0/NaN/empty — fall back to a clear dash.
  const safe = value && value !== 'NaN%' && value !== 'NaN' ? value : null
  return (
    <div>
      <p className="text-[10px] text-[var(--aqar-kohl)]/55">{label}{est ? '*' : ''}</p>
      <p className="text-sm font-bold tabular-nums text-[var(--aqar-green-d)]">{safe ?? '—'}</p>
      {unit ? <p className="text-[9px] text-[var(--aqar-kohl)]/40">{unit}</p> : null}
    </div>
  )
}
