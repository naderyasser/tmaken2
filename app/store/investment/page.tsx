import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, TrendingUp, LineChart, GraduationCap, Phone, Mail, MessageCircle, Sparkles, Layers } from 'lucide-react'
import { store } from '@/lib/frappe-server'
import { formatPrice, formatNumber } from '@/lib/aqar-format'
import InvestmentCard from '@/components/store/investment-card'
import InvestmentFilters from '@/components/store/investment-filters'
import InvestmentDisclaimer from '@/components/store/investment-disclaimer'
import LeadForm from '@/components/store/lead-form'
import { computeMetrics, marketAvgPricePerSqm, EDU_TOPICS, type InvestmentOverview, type ListingMetrics } from '@/lib/investment'
import type { ListingSearchResult } from '@/lib/real-estate-api'

export const revalidate = 120

const ADVISOR = { whatsapp: 'https://wa.me/966553275000', phoneText: '+966 55 327 5000', phoneTel: '+966553275000', email: 'mhmd5100@gmail.com' }

export const metadata: Metadata = {
  title: 'الاستثمار العقاري | تمكين العقارية',
  description: 'فرص استثمارية من عروض موثّقة وفق نظام الهيئة العامة للعقار، مع مؤشّرات تقديرية (السعر/م²، العائد الإيجاري، معدل الرسملة) ومستشار عقاري.',
}

export default async function InvestmentPage({ searchParams }: any) {
  const sp = (await searchParams) || {}
  const city = sp.city || ''
  const category = sp.category || ''
  const listingType = sp.listing_type || 'Sale'
  const priceMin = sp.price_min || ''
  const priceMax = sp.price_max || ''
  const minYield = sp.min_yield || ''
  const sort = sp.sort || ''
  const [data, cats] = await Promise.all([
    store.investment({ city, category, listing_type: listingType, price_min: priceMin, price_max: priceMax, limit: 24 }) as Promise<InvestmentOverview | null>,
    store.categories(),
  ])
  const o: InvestmentOverview = data || { listings: [], rent_by_cat_district: {}, rent_by_cat: {}, area_insights: [], category_counts: [], off_plan_available: false }
  const categories = (cats || []).filter((c: any) => !c.is_group).map((c: any) => ({ name: c.name, category_name_ar: c.category_name_ar }))
  const marketAvg = marketAvgPricePerSqm(o)

  // Pair each listing with its computed metrics; apply the min-gross-yield filter and the chosen
  // sort here (yields are derived from the rent benchmarks, so this happens after fetch).
  let rows: Array<{ l: ListingSearchResult; m: ListingMetrics }> = (o.listings || []).map((l) => ({ l, m: computeMetrics(l, o) }))
  const minY = Number(minYield)
  if (minY > 0) rows = rows.filter((r) => r.m.grossYield != null && r.m.grossYield >= minY)
  if (sort === 'yield') rows = [...rows].sort((a, b) => (b.m.grossYield ?? -1) - (a.m.grossYield ?? -1))
  else if (sort === 'ppsqm') rows = [...rows].sort((a, b) => (a.m.pricePerSqm ?? Infinity) - (b.m.pricePerSqm ?? Infinity))

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* 1 — Hero */}
      <section className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--aqar-green)]/10 text-[var(--aqar-green)]">
          <Building2 className="h-8 w-8" />
        </div>
        <h1 className="aqar-display text-3xl text-[var(--aqar-green-d)] sm:text-4xl">الاستثمار العقاري</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-8 text-[var(--aqar-kohl)]/70">
          فرصٌ من عروضٍ <b>موثّقة وفق نظام الهيئة العامة للعقار</b>، معروضةٌ من منظورٍ استثماري: السعر لكل متر،
          والعائد الإيجاري المتوقّع، ومعدّل الرسملة — مؤشّراتٌ تقديريةٌ شفّافة مبنيةٌ على بيانات الإعلانات لمساعدتك على المقارنة.
        </p>
      </section>

      {/* 4 — Transparency / risk note (kept visible, near the top) */}
      <div className="mt-7"><InvestmentDisclaimer /></div>

      {/* 2 — Curated investment listings */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="aqar-section-title flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-[var(--aqar-green)]" />عروض استثمارية مختارة</h2>
            <p className="mt-1 text-sm text-[var(--aqar-kohl)]/60">عروض بيعٍ موثّقة، مرتّبةٌ بمنظورٍ استثماري (التجاري والمُدِرّ للدخل أولاً).</p>
          </div>
        </div>
        <div className="mb-5">
          <InvestmentFilters
            city={city} category={category} listingType={listingType}
            priceMin={priceMin} priceMax={priceMax} minYield={minYield} sort={sort}
            categories={categories}
          />
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-8 text-center">
            <p className="text-[var(--aqar-kohl)]/70">ما لقينا عروض بهذي الفلاتر.</p>
            <p className="mt-1 text-sm text-[var(--aqar-kohl)]/50">جرّب تغيير المدينة أو القسم، أو امسح الفلاتر.</p>
            <Link href="/investment" className="aqar-btn mt-4">مسح الفلاتر</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map(({ l, m }) => <InvestmentCard key={l.name} l={l} m={m} marketAvg={marketAvg} />)}
          </div>
        )}
        <p className="mt-3 text-[11px] text-[var(--aqar-kohl)]/45">* العائد للعقارات المُؤجَّرة قيمٌ تقديرية تظهر فقط عند توفّر إيجاراتٍ مماثلة؛ والأراضي يكون عائدها عبر إعادة البيع (نموّ المنطقة) لا الإيجار.</p>
      </section>

      {/* 5 — Area / market insights */}
      {o.area_insights.length > 0 && (
        <section className="mt-12">
          <h2 className="aqar-section-title flex items-center gap-2 text-xl"><LineChart className="h-5 w-5 text-[var(--aqar-green)]" />مؤشّرات السوق حسب الحي</h2>
          <p className="mt-1 text-sm text-[var(--aqar-kohl)]/60">
            متوسّط سعر المتر وعدد العروض لكل حي ضمن النطاق المحدّد — من عروض البيع الموثّقة.
            {marketAvg ? <> متوسّط السوق ضمن النطاق: <b className="text-[var(--aqar-green-d)]">{formatNumber(Math.round(marketAvg), 'ar')}</b> ريال/م².</> : null}
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--aqar-border)]">
            <table className="w-full min-w-[420px] text-start text-sm">
              <thead className="bg-[var(--aqar-sand-2)] text-[var(--aqar-kohl)]/70">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">الحي / المدينة</th>
                  <th className="px-3 py-2 text-start font-medium">المدينة</th>
                  <th className="px-3 py-2 text-start font-medium">متوسّط السعر/م²</th>
                  <th className="px-3 py-2 text-start font-medium">متوسّط السعر</th>
                  <th className="px-3 py-2 text-start font-medium">عدد العروض</th>
                </tr>
              </thead>
              <tbody>
                {o.area_insights.map((r) => (
                  <tr key={r.district} className="border-t border-[var(--aqar-border)]">
                    <td className="px-3 py-2 font-medium text-[var(--aqar-kohl)]">{r.district_name_ar || r.district}</td>
                    <td className="px-3 py-2 text-[var(--aqar-kohl)]/70">{r.city_name_ar || '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-[var(--aqar-green-d)]">{formatNumber(Math.round(r.sale_per_sqm), 'ar')} <span className="text-[10px] text-[var(--aqar-kohl)]/40">ريال</span></td>
                    <td className="px-3 py-2 tabular-nums text-[var(--aqar-kohl)]/80">{formatPrice(Math.round(r.avg_price), 'ar')}</td>
                    <td className="px-3 py-2 tabular-nums text-[var(--aqar-kohl)]/70">{formatNumber(r.n, 'ar')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 7 — Educational block */}
      <section className="mt-12">
        <h2 className="aqar-section-title flex items-center gap-2 text-xl"><GraduationCap className="h-5 w-5 text-[var(--aqar-green)]" />تعرّف على أنواع الاستثمار العقاري</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EDU_TOPICS.map((t) => (
            <div key={t.title} className="rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[var(--aqar-kohl)]">{t.title}</h3>
                {!t.live && <span className="rounded-full bg-[var(--aqar-sand-2)] px-2 py-0.5 text-[10px] text-[var(--aqar-kohl)]/55">قريباً عبر شريك مرخّص</span>}
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--aqar-kohl)]/65">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 8 — Advisor CTA + lead form */}
      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-espresso-fill)] p-6 text-white">
          <h2 className="aqar-display text-2xl">تواصل مع مستشار عقاري</h2>
          <p className="mt-2 text-sm leading-7 text-white/80">احصل على استشارةٍ حول الفرص المناسبة لأهدافك الاستثمارية، من فريقٍ مختصّ.</p>
          <div className="mt-5 space-y-2.5 text-sm">
            <a href={ADVISOR.whatsapp} target="_blank" rel="noopener" className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15">
              <MessageCircle className="h-5 w-5" /><span>واتساب — تواصل مباشر</span>
            </a>
            <a href={`tel:${ADVISOR.phoneTel}`} className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15">
              <Phone className="h-5 w-5" /><span dir="ltr" className="tabular-nums">{ADVISOR.phoneText}</span>
            </a>
            <a href={`mailto:${ADVISOR.email}`} className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15">
              <Mail className="h-5 w-5" /><span dir="ltr">{ADVISOR.email}</span>
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-6">
          <h2 className="aqar-section-title text-xl">اطلب استشارة</h2>
          <p className="mt-1.5 text-sm text-[var(--aqar-kohl)]/65">اترك بياناتك وسيتواصل معك مستشارٌ عقاري.</p>
          <div className="mt-5"><LeadForm topic="Investment" submitLabel="أرسل الطلب" /></div>
        </div>
      </section>

      {/* 6 + 9 — Off-plan + roadmap (coming soon via CMA-licensed partner) */}
      <section className="mt-12">
        <h2 className="aqar-section-title flex items-center gap-2 text-xl"><Layers className="h-5 w-5 text-[var(--aqar-green)]" />قريباً</h2>
        <p className="mt-1 text-sm text-[var(--aqar-kohl)]/60">منتجاتٌ استثماريةٌ إضافية — تُطرح المنتجات التمويلية عبر شريكٍ مرخّصٍ من هيئة السوق المالية (CMA).</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { t: 'البيع على الخارطة', d: 'مشاريع تحت الإنشاء بسعر دخولٍ وموعد تسليمٍ ومطوّر — ستظهر هنا عند توفّر مشاريع موثّقة.' },
            { t: 'التمويل الجماعي العقاري', d: 'المشاركة في تمويل عقارٍ بحصصٍ صغيرة — عبر منصّةٍ مرخّصة من هيئة السوق المالية.' },
            { t: 'الصناديق العقارية (REITs)', d: 'استثمارٌ عقاريٌّ متداولٌ بسيولةٍ أعلى — عبر شريكٍ مرخّص.' },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] bg-[var(--aqar-surface)]/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--aqar-kohl)]">{x.t}</h3>
                <span className="rounded-full bg-[var(--aqar-sand-2)] px-2 py-0.5 text-[10px] text-[var(--aqar-kohl)]/55">قريباً</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--aqar-kohl)]/60">{x.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--aqar-kohl)]"><TrendingUp className="h-4 w-4 text-[var(--aqar-green)]" />أعلِمني عند إطلاق المنتجات الاستثمارية</p>
          <LeadForm topic="Investment" compact submitLabel="سجّل اهتمامي" />
        </div>
      </section>
    </div>
  )
}
