import Link from 'next/link'
import { MapPin, BedDouble, Maximize, Star, Eye } from 'lucide-react'
import { formatPrice, formatNumber, timeAgo } from '@/lib/aqar-format'
import ListingContact from '@/components/store/listing-contact'
import RatingBadge from '@/components/store/rating-badge'
import ListingImage from '@/components/store/listing-image'
import FavoriteButton from '@/components/store/favorite-button'
import CompareButton from '@/components/store/compare-button'
import VerifiedBadge from '@/components/store/verified-badge'
import type { ListingSearchResult } from '@/lib/real-estate-api'

/** Server-renderable storefront card (Haraj-style hierarchy: title → district/city → time → license).
 *  Contact buttons sit OUTSIDE the card Link (no nested anchors) so واتساب/اتصال are one tap away. */
export default function StoreListingCard({ l }: { l: ListingSearchResult }) {
  const city = l.city_name_ar || l.city
  const district = l.district_name_ar || l.district
  // "جديد" if published within the last 7 days (reuses the existing creation date — no backend field).
  const isNew = !!l.creation && (Date.now() - new Date(l.creation).getTime()) <= 7 * 86_400_000
  return (
    <div className="aqar-card flex flex-col">
      <Link href={`/listing/${l.name}`} className="flex flex-1 flex-col">
      <div className="relative h-44 w-full bg-[var(--aqar-sand-2)]">
        <ListingImage src={l.primary_image} alt={l.title} />
        <div className="absolute top-2 flex flex-col gap-1" style={{ insetInlineStart: '0.5rem' }}>
          {l.is_featured ? (
            <span className="aqar-badge-featured inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold">
              <Star className="h-3 w-3" />مميّز
            </span>
          ) : null}
          {isNew ? (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-[var(--aqar-green)] px-2.5 py-0.5 text-xs font-bold text-white">جديد</span>
          ) : null}
        </div>
        <span className="absolute top-2" style={{ insetInlineEnd: '0.5rem' }}>
          <FavoriteButton listing={l} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        {/* title (primary) + موثّق as a small badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-bold text-[var(--aqar-kohl)]">{l.title}</h3>
          {l.rega_ad_license_number ? <VerifiedBadge className="shrink-0" /> : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--aqar-kohl)]/55">
          <MapPin className="h-3.5 w-3.5" />{[district, city].filter(Boolean).join('، ')}
        </p>
        {/* price (primary) */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="aqar-price text-xl">{formatPrice(l.price, 'ar', l.listing_type)}</p>
          <RatingBadge ratingAvg={l.rating_avg} reviewCount={l.review_count} />
        </div>
        {/* specs (secondary) */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[var(--aqar-kohl)]/70">
          {l.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{formatNumber(l.bedrooms, 'ar')} غرف</span>}
          {l.area_sqm != null && <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{formatNumber(l.area_sqm, 'ar')} م²</span>}
        </div>
        {/* views/date (muted meta — views collapse on the smallest screens) */}
        {(l.views_count != null || l.creation) && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--aqar-kohl)]/40">
            {l.views_count != null && <span className="hidden items-center gap-1 sm:inline-flex"><Eye className="h-3 w-3" />{formatNumber(l.views_count, 'ar')} مشاهدة</span>}
            {l.views_count != null && l.creation && <span className="hidden sm:inline">·</span>}
            {l.creation && <span>{timeAgo(l.creation, 'ar')}</span>}
          </div>
        )}
      </div>
      </Link>
      {/* primary actions (واتساب/اتصال) + secondary compare icon */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <div className="min-w-0 flex-1"><ListingContact listing={l.name} /></div>
        <CompareButton listing={l} iconOnly />
      </div>
    </div>
  )
}
