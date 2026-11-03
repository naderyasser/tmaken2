// Investment-lens helpers. Every metric is computed ONLY from existing listing data; where the
// underlying data is missing the metric is returned as null (the UI shows "غير متوفر", never a
// fabricated number). Yields are ESTIMATES derived from comparable Rent listings + a disclosed
// operating-cost assumption — clearly labelled as such in the UI; this is not investment advice.

import type { ListingSearchResult } from './real-estate-api'

/** Assumed operating-cost ratio applied to gross rent to approximate a net yield / cap rate. */
export const INVEST_OPEX = 0.25
/** Typical KSA gross rental-yield band, used only for a "within the usual range" hint. */
export const YIELD_BAND = { min: 5, max: 9 }
/** Minimum comparable Rent listings required before we estimate a yield (avoid thin-data noise). */
export const MIN_RENT_COMPARABLES = 3

interface RentBenchmark { v: number; n: number }

export interface InvestmentOverview {
  listings: ListingSearchResult[]
  rent_by_cat_district: Record<string, RentBenchmark>
  rent_by_cat: Record<string, RentBenchmark>
  area_insights: Array<{
    district: string
    district_name_ar?: string
    city_name_ar?: string
    n: number
    avg_price: number
    sale_per_sqm: number
  }>
  category_counts: Array<{ category: string; category_name_ar?: string; n: number }>
  off_plan_available: boolean
}

export interface ListingMetrics {
  pricePerSqm: number | null
  grossYield: number | null // % per year (estimate)
  netYield: number | null // % per year after assumed opex (cap-rate proxy / simple ROI)
  annualRent: number | null // estimated SAR/year
  rentSource: 'district' | 'category' | null
  rentN: number | null // # of comparable Rent listings the estimate rests on
}

/** Most specific avg ANNUAL rent per m² for this listing (district → category), but ONLY when it
 *  rests on ≥ MIN_RENT_COMPARABLES comparable rent listings — else null (yield shown as غير متوفر). */
function pickRentPerSqm(o: InvestmentOverview, category?: string, district?: string): { v: number; n: number; src: 'district' | 'category' } | null {
  if (category && district) {
    const b = o.rent_by_cat_district[`${category}|${district}`]
    if (b && b.v && b.n >= MIN_RENT_COMPARABLES) return { v: b.v, n: b.n, src: 'district' }
  }
  if (category) {
    const b = o.rent_by_cat[category]
    if (b && b.v && b.n >= MIN_RENT_COMPARABLES) return { v: b.v, n: b.n, src: 'category' }
  }
  return null
}

export function computeMetrics(l: ListingSearchResult, o: InvestmentOverview): ListingMetrics {
  const area = l.area_sqm && l.area_sqm > 0 ? l.area_sqm : null
  const price = l.price && l.price > 0 ? l.price : null
  const pricePerSqm = area && price ? price / area : null

  let grossYield: number | null = null
  let netYield: number | null = null
  let annualRent: number | null = null
  let rentSource: 'district' | 'category' | null = null
  let rentN: number | null = null

  // Rental yield only applies to a property you BUY to rent out — Sale listings only. Rent /
  // Daily Rent listings (and the daily rate) are never treated as an annual yield.
  const rent = l.listing_type === 'Sale' ? pickRentPerSqm(o, l.category, l.district) : null
  if (area && price && rent) {
    // KSA "Rent" listings quote ANNUAL rent, so the benchmark is annual rent per m² — no ×12.
    annualRent = rent.v * area
    const gy = (annualRent / price) * 100
    // Sanity clamp: data-quality outliers (mismatched units, miskeyed prices) would render absurd
    // figures; outside a plausible band we show "غير متوفر" rather than a misleading number.
    if (gy >= 1 && gy <= 25) {
      grossYield = gy
      netYield = gy * (1 - INVEST_OPEX)
      rentSource = rent.src
      rentN = rent.n
    } else {
      annualRent = null
    }
  }
  return { pricePerSqm, grossYield, netYield, annualRent, rentSource, rentN }
}

/** Lands return via resale/appreciation, not rent — there is no land rental yield. */
export function isLand(l: ListingSearchResult): boolean {
  return l.category === 'Lands'
}

/** Price/m² positioning vs the area average (% above/below). For the lands "resale" framing
 * and any "entry vs market" hint. Returns null when either side is missing. */
export function vsMarketPct(pricePerSqm: number | null, marketAvg: number | null): number | null {
  if (!pricePerSqm || !marketAvg) return null
  return (pricePerSqm / marketAvg - 1) * 100
}

/** Average sale price/m² across the insight rows (for a market reference line). */
export function marketAvgPricePerSqm(o: InvestmentOverview): number | null {
  const rows = o.area_insights.filter((r) => r.sale_per_sqm > 0)
  if (!rows.length) return null
  const totalN = rows.reduce((s, r) => s + r.n, 0)
  if (!totalN) return null
  return rows.reduce((s, r) => s + r.sale_per_sqm * r.n, 0) / totalN
}

/** Educational content — KSA real-estate investment types (informational, not advice). */
export const EDU_TOPICS: Array<{ title: string; body: string; live: boolean }> = [
  {
    title: 'التملّك المباشر',
    body: 'شراء عقار جاهز (سكني أو تجاري) بهدف التأجير أو إعادة البيع. أوضح أنواع الاستثمار وأكثرها مباشرة، وكل العروض هنا موثّقة وفق نظام الهيئة العامة للعقار.',
    live: true,
  },
  {
    title: 'البيع على الخارطة',
    body: 'الشراء في مشروع تحت الإنشاء بسعر دخول أقل غالباً، مع مخاطر مرتبطة بمواعيد التسليم والمطوّر. تُنظّمه «إيجار» ووديعة المشاريع لدى الهيئة. سيظهر هنا عند توفّر مشاريع موثّقة.',
    live: false,
  },
  {
    title: 'الصناديق العقارية (REITs)',
    body: 'صناديق متداولة مرخّصة من هيئة السوق المالية (CMA) تتيح الاستثمار العقاري بمبالغ صغيرة وسيولة أعلى دون تملّك مباشر. تُطرح عبر شريك مرخّص.',
    live: false,
  },
  {
    title: 'التمويل الجماعي العقاري',
    body: 'منصّات مرخّصة من هيئة السوق المالية تتيح المشاركة في تمويل عقار بحصص صغيرة. يتطلّب ترخيص CMA؛ سيُتاح عبر شريك مرخّص ولا يُقدَّم هنا حالياً.',
    live: false,
  },
]
