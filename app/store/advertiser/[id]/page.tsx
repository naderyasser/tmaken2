import { notFound } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { store } from '@/lib/frappe-server'
import StoreListingCard from '@/components/store/listing-card'
import OfficeReviews from '@/components/store/office-reviews'
import RatingBadge from '@/components/store/rating-badge'

export const revalidate = 120

const TYPE_AR: Record<string, string> = { Individual: 'فرد', Broker: 'وسيط عقاري', Agency: 'مكتب عقاري' }

export async function generateMetadata({ params }: any) {
  const { id } = await params
  const data = await store.advertiser(id)
  const name = data?.profile?.advertiser_name || 'معلن'
  return { title: `${name} | تمكين عقار`, description: `إعلانات ${name} الموثّقة على تمكين عقار.` }
}

export default async function AdvertiserPage({ params }: any) {
  const { id } = await params
  const [data, reviews] = await Promise.all([store.advertiser(id), store.officeReviews(id)])
  if (!data?.profile) notFound()
  const p = data.profile
  const listings = data.listings || []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="aqar-card flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--aqar-green)] text-2xl font-bold text-white">
          {(p.advertiser_name || '؟').slice(0, 1)}
        </div>
        <div>
          <h1 className="aqar-display text-2xl text-[var(--aqar-kohl)]">{p.advertiser_name}</h1>
          <p className="text-sm text-[var(--aqar-kohl)]/60">{TYPE_AR[p.user_type] || p.user_type}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.is_phone_verified ? <V label="جوال موثّق" /> : null}
            {p.nafath_verified ? <V label="موثّق عبر نفاذ" /> : null}
            {p.fal_license_number ? <V label="رخصة فال" /> : null}
            <RatingBadge ratingAvg={p.rating_avg} reviewCount={p.review_count} size="md" />
          </div>
        </div>
      </div>

      <h2 className="aqar-display mt-8 mb-4 text-xl text-[var(--aqar-kohl)]">إعلانات المعلن</h2>
      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--aqar-sand-2)] p-12 text-center text-[var(--aqar-kohl)]/50">لا توجد إعلانات نشطة</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((l: any) => <StoreListingCard key={l.name} l={l} />)}
        </div>
      )}

      <OfficeReviews office={id} initial={reviews} canWrite={process.env.ENABLE_BUYER_LOGIN === 'true'} />
    </div>
  )
}

function V({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(176,141,87,0.14)] px-2.5 py-0.5 text-xs font-medium text-[var(--aqar-bronze-d)]"><BadgeCheck className="h-3.5 w-3.5" />{label}</span>
}
