import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ShieldCheck, BadgeCheck, MapPin, BedDouble, Bath, Maximize, Compass, TrendingUp, Sofa, Layers, CalendarClock } from 'lucide-react'
import { store } from '@/lib/frappe-server'
import { formatPrice, formatPriceIndic, formatNumber, dualDate } from '@/lib/aqar-format'
import StoreListingCard from '@/components/store/listing-card'
import ListingQR from '@/components/store/listing-qr'
import ListingMapClient from '@/components/store/listing-map-client'
import ListingGallery from '@/components/store/listing-gallery'
import ListingContact from '@/components/store/listing-contact'
import RatingBadge from '@/components/store/rating-badge'
import FavoriteButton from '@/components/store/favorite-button'
import ShareButton from '@/components/store/share-button'
import ShareImageButton from '@/components/store/share-image-button'
import MortgageCalc from '@/components/store/mortgage-calc'
import InvestmentDisclaimer from '@/components/store/investment-disclaimer'
import { computeMetrics, marketAvgPricePerSqm, vsMarketPct, type InvestmentOverview } from '@/lib/investment'

export const revalidate = 120

export async function generateMetadata({ params }: any) {
  const { id } = await params
  const l = await store.listing(id)
  if (!l) return { title: 'إعلان غير متوفر | تمكين عقار' }
  const loc = [l.district_names?.district_name_ar, l.city_names?.city_name_ar].filter(Boolean).join('، ')
  const desc = `${l.title} — ${formatPrice(l.price, 'ar', l.listing_type)}${loc ? ` في ${loc}` : ''}. إعلان موثّق وفق نظام الهيئة العامة للعقار.`
  const img = l.images?.[0]?.webp_thumb || l.images?.[0]?.image
  return {
    title: `${l.title} | تمكين عقار`,
    description: desc,
    openGraph: { title: l.title, description: desc, images: img ? [img] : [], type: 'article' },
  }
}

export default async function StoreListingDetail({ params }: any) {
  const { id } = await params
  const l = await store.listing(id)
  if (!l) notFound()
  // Investment metrics for Sale listings: fetch the rent benchmarks once and compute this listing's
  // estimated figures (Sale-only; lands are framed by resale, not rent).
  const [similar, inv] = await Promise.all([
    store.similar(id),
    l.listing_type === 'Sale' ? store.investment({ city: l.city, category: l.category, limit: 1 }) : Promise.resolve(null),
  ])
  const similarList = similar || []
  const invO = inv as InvestmentOverview | null
  const invM = invO ? computeMetrics(l as any, invO) : null
  const invMarketAvg = invO ? marketAvgPricePerSqm(invO) : null
  const isLandListing = l.category === 'Lands'
  const cover = l.images?.find((i: any) => i.is_primary) || l.images?.[0]
  const loc = [l.district_names?.district_name_ar, l.city_names?.city_name_ar].filter(Boolean).join('، ')
  // Minimal snapshot so the favorites view can render this listing offline.
  const favSnapshot = {
    name: id, title: l.title, price: l.price, listing_type: l.listing_type,
    city_name_ar: l.city_names?.city_name_ar, district_name_ar: l.district_names?.district_name_ar,
    city: l.city, district: l.district, area_sqm: l.area_sqm, bedrooms: l.bedrooms,
    rega_ad_license_number: l.rega_ad_license_number,
    creation: l.published_at || undefined, views_count: l.views_count,
    primary_image: cover ? (cover.webp_thumb || cover.image) : null,
  }
  const ad = l.rega_ad_data || {}
  const li = l.licensed_ad_info || {}

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Residence',
    name: l.title,
    description: (l.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
    image: l.images?.map((i: any) => i.image) || [],
    address: { '@type': 'PostalAddress', addressRegion: l.city_names?.city_name_ar, addressCountry: 'SA' },
    offers: { '@type': 'Offer', price: l.price, priceCurrency: 'SAR' },
    ...(l.area_sqm ? { floorSize: { '@type': 'QuantitativeValue', value: l.area_sqm, unitCode: 'MTK' } } : {}),
    ...(l.bedrooms ? { numberOfRooms: l.bedrooms } : {}),
  }

  const licenseRows: Array<[string, any]> = [
    ['رقم المخطط', li.plan_number], ['رقم القطعة', li.plot_number],
    ['خدمات العقار', (li.property_services || []).join('، ')], ['استخدامات العقار', li.property_usages],
    ['الضمانات ومدتها', li.guarantees_and_duration], ['الالتزامات الأخرى', li.other_obligations],
    ['النزاعات القائمة', li.disputes], ['وصف الموقع حسب الصك', li.location_description_per_deed],
    ['صاحب الترخيص', li.licensee_name], ['رقم الصك', ad.deed_number],
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* breadcrumb chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/" className="text-[var(--aqar-kohl)]/50 hover:underline">الرئيسية</Link>
        {l.category_names?.category_name_ar && <Link href={`/search?category=${encodeURIComponent(l.category)}`} className="aqar-chip">{l.category_names.category_name_ar}</Link>}
        {l.city_names?.city_name_ar && <Link href={`/${encodeURIComponent(l.city)}`} className="aqar-chip">{l.city_names.city_name_ar}</Link>}
        {l.district_names?.district_name_ar && l.district && <Link href={`/${encodeURIComponent(l.city)}/${encodeURIComponent(l.district)}`} className="aqar-chip">{l.district_names.district_name_ar}</Link>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* gallery — interactive: arrows + thumbnails + dots + keyboard + swipe + lightbox */}
          <ListingGallery images={l.images} title={l.title} />

          {/* title + specs */}
          <div className="aqar-card p-5">
            <h1 className="aqar-display text-2xl text-[var(--aqar-kohl)]">{l.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-[var(--aqar-kohl)]/60"><MapPin className="h-4 w-4" />{loc}</p>
            <p className="aqar-price mt-3 text-3xl" aria-label={formatPrice(l.price, 'ar', l.listing_type)}>{formatPriceIndic(l.price, l.listing_type)}</p>
            {l.payment_terms && <p className="text-sm text-[var(--aqar-kohl)]/60">{l.payment_terms}</p>}
            {/* Save + share */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FavoriteButton listing={favSnapshot} variant="inline" />
              <ShareButton title={l.title} />
              <ShareImageButton
                title={l.title}
                priceText={formatPrice(l.price, 'ar', l.listing_type)}
                license={l.rega_ad_license_number}
                qrValue={l.rega_qr_payload}
                imageUrl={cover ? (cover.image || cover.webp_thumb) : null}
              />
            </div>
            {/* Contact above the fold — WhatsApp primary + one-tap call */}
            <ListingContact listing={id} className="mt-4" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {l.area_sqm != null && <Spec icon={Maximize} label="المساحة" value={`${formatNumber(l.area_sqm, 'ar')} م²`} />}
              {l.bedrooms != null && <Spec icon={BedDouble} label="غرف" value={formatNumber(l.bedrooms, 'ar')} />}
              {l.bathrooms != null && <Spec icon={Bath} label="دورات مياه" value={formatNumber(l.bathrooms, 'ar')} />}
              {l.facade && <Spec icon={Compass} label="الواجهة" value={l.facade} />}
              {l.furnished && <Spec icon={Sofa} label="الفرش" value={l.furnished} />}
              {l.floor_level && <Spec icon={Layers} label="الدور" value={l.floor_level} />}
              {l.age_years != null && <Spec icon={CalendarClock} label="عمر العقار" value={`${formatNumber(l.age_years, 'ar')} سنة`} />}
            </div>
            {l.description && <div className="mt-4 whitespace-pre-line leading-8 text-[var(--aqar-kohl)]/85">{l.description.replace(/<[^>]+>/g, '')}</div>}
          </div>

          {/* معلومات العقار حسب الرخصة + QR */}
          <div className="aqar-card">
            <div className="flex items-center gap-2 border-b border-[var(--aqar-sand-2)] px-5 py-3">
              <ShieldCheck className="h-5 w-5 text-[var(--aqar-green)]" />
              <h2 className="aqar-display text-lg text-[var(--aqar-green-d)]">معلومات العقار حسب الرخصة</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  <Row k="رقم الترخيص الإعلاني" v={ad.ad_license_number} />
                  <Row k="انتهاء الترخيص" v={ad.license_expiry ? dualDate(ad.license_expiry, 'ar') : null} />
                  {licenseRows.filter(([, v]) => v).map(([k, v]) => <Row key={k} k={k} v={v} />)}
                </div>
              </div>
              {l.rega_qr_payload && (
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <ListingQR value={l.rega_qr_payload} />
                  <p className="text-xs text-[var(--aqar-kohl)]/50">رمز التحقق من الهيئة</p>
                </div>
              )}
            </div>
          </div>

          {/* map */}
          {(l.latitude || l.longitude) ? (
            <div className="aqar-card p-5">
              <h2 className="aqar-display mb-3 flex items-center gap-2 text-lg text-[var(--aqar-kohl)]"><MapPin className="h-5 w-5 text-[var(--aqar-green)]" />الموقع{l.location_obscured ? ' (تقريبي)' : ''}</h2>
              <ListingMapClient lat={l.latitude} lng={l.longitude} obscured={!!l.location_obscured} />
            </div>
          ) : null}

          {/* comments (read-only on the public site) */}
          <Comments listing={id} />
        </div>

        {/* sidebar: advertiser */}
        <div className="space-y-5">
          <div className="aqar-card p-5">
            <p className="text-sm text-[var(--aqar-kohl)]/50">المعلن</p>
            <p className="mt-1 text-lg font-bold text-[var(--aqar-kohl)]">{l.advertiser?.advertiser_name || '—'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {l.advertiser?.is_phone_verified ? <V label="جوال موثّق" /> : null}
              {l.advertiser?.nafath_verified ? <V label="موثّق عبر نفاذ" /> : null}
              {l.advertiser?.fal_license_number ? <V label="رخصة فال" /> : null}
              <RatingBadge ratingAvg={l.advertiser?.rating_avg} reviewCount={l.advertiser?.review_count} />
            </div>
            {l.advertiser?.name && (l.advertiser?.review_count ?? 0) > 0 ? (
              <Link href={`/advertiser/${l.advertiser.name}`} className="mt-2 inline-block text-xs font-medium text-[var(--aqar-green)] hover:underline">عرض كل التقييمات</Link>
            ) : null}
            <div className="mt-4 space-y-2">
              <ListingContact listing={id} />
              <Link href="/post" className="aqar-btn aqar-btn-outline w-full">راسل المعلن عبر المنصة</Link>
            </div>
            <p className="mt-2 text-center text-xs text-[var(--aqar-kohl)]/40">{formatNumber(l.views_count || 0, 'ar')} مشاهدة</p>
          </div>
          {/* Investment panel (Sale only) — estimates + disclaimer */}
          {l.listing_type === 'Sale' && invM && (invM.pricePerSqm != null || invM.grossYield != null || isLandListing) ? (
            <div className="aqar-card p-5">
              <h2 className="aqar-display mb-3 flex items-center gap-2 text-lg text-[var(--aqar-kohl)]"><TrendingUp className="h-5 w-5 text-[var(--aqar-green)]" />المؤشّرات الاستثمارية</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <PanelMetric label="السعر/م²" value={invM.pricePerSqm != null ? formatNumber(Math.round(invM.pricePerSqm), 'ar') : '—'} unit="ريال" />
                {isLandListing ? (
                  <>
                    <PanelMetric label="مقابل السوق" value={fmtSigned(vsMarketPct(invM.pricePerSqm, invMarketAvg))} unit="متوسّط الحي" />
                    <PanelMetric label="نوع العائد" value="إعادة البيع" unit="نموّ المنطقة" />
                  </>
                ) : (
                  <>
                    <PanelMetric label="العائد الإجمالي" value={invM.grossYield != null ? `${invM.grossYield.toFixed(1)}%` : '—'} unit="سنوياً" />
                    <PanelMetric label="العائد الصافي" value={invM.netYield != null ? `${invM.netYield.toFixed(1)}%` : '—'} unit="تقديري" />
                  </>
                )}
              </div>
              {!isLandListing && invM.grossYield != null && invM.rentN ? (
                <p className="mt-2 text-[11px] text-[var(--aqar-kohl)]/50">تقديري بناءً على {formatNumber(invM.rentN, 'ar')} عقارات مماثلة</p>
              ) : null}
              <div className="mt-3"><InvestmentDisclaimer compact /></div>
              <Link href="/investment" className="mt-3 inline-block text-xs font-medium text-[var(--aqar-green)] hover:underline">استكشف الاستثمار العقاري ←</Link>
            </div>
          ) : null}
          {l.listing_type === 'Sale' && l.price ? <MortgageCalc price={l.price} /> : null}
        </div>
      </div>

      {/* similar */}
      {similarList.length > 0 && (
        <div className="mt-10">
          <h2 className="aqar-display mb-4 text-2xl text-[var(--aqar-kohl)]">عروض مشابهة</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similarList.map((s: any) => <StoreListingCard key={s.name} l={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}

async function Comments({ listing }: { listing: string }) {
  const comments = (await store.comments(listing)) || []
  if (!comments.length) return null
  return (
    <div className="aqar-card p-5">
      <h2 className="aqar-display mb-3 text-lg text-[var(--aqar-kohl)]">الأسئلة والتعليقات</h2>
      <ul className="space-y-2">
        {comments.map((c: any) => (
          <li key={c.name} className={c.parent_comment ? 'ms-6' : ''}>
            <div className="rounded-xl bg-[var(--aqar-sand)] p-3">
              <p className="text-sm text-[var(--aqar-kohl)]/85">{c.body}</p>
              <p className="mt-1 text-xs text-[var(--aqar-kohl)]/40">{c.author_name}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Spec({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-xl bg-[var(--aqar-sand)] p-2.5 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-[var(--aqar-green)]" />
      <p className="text-[11px] text-[var(--aqar-kohl)]/50">{label}</p>
      <p className="text-sm font-bold text-[var(--aqar-kohl)]">{value}</p>
    </div>
  )
}
function fmtSigned(v: number | null) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(0)}%`
}
function PanelMetric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const safe = value && value !== 'NaN%' ? value : '—'
  return (
    <div className="rounded-xl bg-[var(--aqar-sand)] p-2">
      <p className="text-[10px] text-[var(--aqar-kohl)]/55">{label}</p>
      <p className="text-sm font-bold tabular-nums text-[var(--aqar-green-d)]">{safe}</p>
      {unit ? <p className="text-[9px] text-[var(--aqar-kohl)]/40">{unit}</p> : null}
    </div>
  )
}
function Row({ k, v }: { k: string; v: any }) {
  if (!v) return null
  return <div className="flex flex-col"><span className="text-xs text-[var(--aqar-kohl)]/45">{k}</span><span className="text-sm font-medium text-[var(--aqar-kohl)]">{String(v)}</span></div>
}
function V({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(176,141,87,0.14)] px-2.5 py-0.5 text-xs font-medium text-[var(--aqar-bronze-d)]"><BadgeCheck className="h-3.5 w-3.5" />{label}</span>
}
